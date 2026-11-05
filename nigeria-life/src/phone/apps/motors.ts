import { BackendService } from '../../backend/BackendService';
import { Garage } from '../../realestate/Garage';
import {
  Motors,
  LUXURY_CARS,
  TUNING_OPTIONS,
  type LuxuryCarSpec,
  type TuningOptionSpec,
} from '../../vehicles/Motors';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

let syncedAt = 0;

export const motorsApp: PhoneApp = {
  id: 'motors',
  name: 'Motors',
  icon: '🏎️',
  tint: ['#0f172a', '#1e293b'],
  purpose: 'Luxury car dealership, custom pearlescent wraps, Stage 2 turbo remaps & VIP sirens.',
  badge: () => 0,
  render: (host) => {
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
          <div class="nl-card" data-model-card="${esc(model.id)}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <div class="nl-card-title">${esc(model.icon)} ${esc(model.name)}</div>
                <div class="nl-card-line" style="margin-top:2px;">${esc(model.brand)} · <span class="nl-tag">${esc(model.badge)}</span></div>
              </div>
              <span class="nl-tag nl-tag--good">${naira(model.price)}</span>
            </div>
            <div class="nl-card-line" style="margin-top:4px;">${esc(model.description)}</div>
            <div class="nl-stats">
              <span><strong>${model.topSpeedKmh} km/h</strong>Top Speed</span>
              <span><strong>${model.horsepower} HP</strong>Power</span>
              <span><strong>${model.accelSeconds}s</strong>0-100 km/h</span>
            </div>
            <div style="margin-top:6px;">
              <button class="nl-btn nl-btn--primary nl-btn--block" data-act="buy-car" data-model="${esc(model.id)}" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `🔑 Purchase Vehicle (${naira(model.price)})` : `Need ${naira(model.price - totalFunds)} More`}
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else if (tab === 'tuning') {
      if (!active) {
        content = empty('🏎️', 'No Vehicle in Fleet', 'Purchase a luxury vehicle from the Showroom to unlock bespoke tuning packages.');
      } else {
        const model = LUXURY_CARS[active.modelId] ?? LUXURY_CARS.gwagon;
        const tuningSpecs = motors.tuningOptions();

        const activeWrapName = active.wrap ? TUNING_OPTIONS[active.wrap]?.name : 'Factory OEM Paint';
        const activeTurboName = active.turbo ? TUNING_OPTIONS[active.turbo]?.name : 'Factory Turbo';
        const activeRimsName = active.rims ? TUNING_OPTIONS[active.rims]?.name : 'Standard Factory Alloys';

        content = `
          <div class="nl-card nl-card--live">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <div class="nl-card-title">Selected: ${esc(model.name)}</div>
                <div class="nl-card-line" style="margin-top:2px;">Active Spec: <strong>${esc(activeWrapName)}</strong> · <strong>${esc(activeTurboName)}</strong> · <strong>${esc(activeRimsName)}</strong></div>
              </div>
              <span class="nl-tag ${active.hasVipSiren ? 'nl-tag--good' : 'nl-tag--muted'}">${active.hasVipSiren ? '🚨 VIP Siren Equipped' : 'Civic Mode'}</span>
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
              <div class="nl-card" data-tuning-card="${esc(opt.id)}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div class="nl-card-title">${esc(opt.icon)} ${esc(opt.name)}</div>
                    <div class="nl-card-line" style="margin-top:2px;"><span class="nl-tag">${esc(opt.category.toUpperCase())}</span>${opt.bonusHp ? ` · <strong>+${opt.bonusHp} HP</strong>` : ''}${opt.bonusSpeed ? ` · <strong>+${opt.bonusSpeed} km/h</strong>` : ''}</div>
                  </div>
                  <span class="nl-tag ${installed ? 'nl-tag--good' : 'nl-tag--warn'}">${installed ? '✓ Installed' : naira(opt.price)}</span>
                </div>
                <div class="nl-card-line" style="margin-top:4px;">${esc(opt.description)}</div>
                <div style="margin-top:6px;">
                  ${
                    installed
                      ? `<button class="nl-btn nl-btn--block" disabled>✓ Active On Vehicle</button>`
                      : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="tune-car" data-car="${esc(active.vehicleId)}" data-option="${esc(opt.id)}" ${canAfford ? '' : 'disabled'}>
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
        ? empty('🚗', 'Your Fleet is Empty', 'Browse the Showroom tab to acquire high-performance luxury vehicles.')
        : owned.map((rec) => {
            const model = LUXURY_CARS[rec.modelId] ?? LUXURY_CARS.gwagon;
            const isSelected = active?.vehicleId === rec.vehicleId;
            const wrapName = rec.wrap ? TUNING_OPTIONS[rec.wrap]?.name : 'Factory OEM';
            const turboName = rec.turbo ? TUNING_OPTIONS[rec.turbo]?.name : 'Stock Turbo';
            const extraHp = (rec.turbo ? TUNING_OPTIONS[rec.turbo]?.bonusHp ?? 0 : 0);
            const totalHp = model.horsepower + extraHp;
            const garageRec = Garage.get().record(rec.vehicleId);
            const plate = garageRec?.plate ?? 'LAG-VIP';

            return `
              <div class="nl-card" data-fleet-card="${esc(rec.vehicleId)}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div class="nl-card-title">${esc(model.icon)} ${esc(model.name)}</div>
                    <div class="nl-card-line" style="margin-top:2px;">Plate: <strong>${esc(plate)}</strong> · ${esc(wrapName)} · ${esc(turboName)} · <strong>${totalHp} HP</strong></div>
                  </div>
                  ${isSelected ? `<span class="nl-tag nl-tag--good">✓ Active Beast</span>` : ''}
                </div>
                <div class="nl-stats" style="margin-top:6px;">
                  <span><strong>${model.topSpeedKmh + (rec.turbo ? TUNING_OPTIONS[rec.turbo]?.bonusSpeed ?? 0 : 0)} km/h</strong>Top Speed</span>
                  <span><strong>${rec.hasVipSiren ? 'Active' : 'Standard'}</strong>VIP Siren</span>
                  <span><strong>${totalHp} HP</strong>Total Power</span>
                </div>
                <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                  <button class="nl-btn nl-btn--primary nl-btn--block" data-act="bring-car" data-car="${esc(rec.vehicleId)}">
                    🚗 Have it brought to me (Drive now)
                  </button>
                  <div style="display:flex; gap:6px;">
                    <button class="nl-btn" style="flex:1;" data-act="open-garage" data-car="${esc(rec.vehicleId)}">
                      🔧 View in Garage
                    </button>
                    ${
                      isSelected
                        ? `<button class="nl-btn" style="flex:1;" disabled>✓ Selected</button>`
                        : `<button class="nl-btn" style="flex:1;" data-act="select-car" data-car="${esc(rec.vehicleId)}">Select for Tuning</button>`
                    }
                  </div>
                </div>
              </div>
            `;
          }).join('');
    }

    return {
      title: 'Motors',
      body: `
        <div class="nl-hero nl-hero--blue">
          <span class="nl-hero-label">Eko Auto Salon · Luxury Motors</span>
          <span class="nl-hero-value">${active ? esc(LUXURY_CARS[active.modelId]?.name.split(' ')[0] ?? 'Motors') : 'Eko Motors'}</span>
          <span class="nl-hero-sub">Fleet: <strong>${owned.length} Supercar${owned.length === 1 ? '' : 's'}</strong> · Total Funds: <strong>${naira(totalFunds)}</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="mt.tab" data-value="showroom">🏎️ Showroom</button>
            <button class="nl-btn nl-btn--glass" data-set="mt.tab" data-value="tuning">🔧 Tuning Bay</button>
          </div>
        </div>
        <div class="nl-section">Dealership Catalog</div>
        ${chips('mt.tab', tab, [
          ['showroom', 'Showroom'],
          ['tuning', 'Tuning Bay'],
          ['fleet', `My Fleet (${owned.length})`],
        ])}
        <div class="nl-list" style="margin-top:8px;">
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
      if (res.ok) {
        host.say(`${res.message} Added to your Garage fleet.`, 'good');
        host.set('mt.tab', 'fleet');
      } else {
        host.say(res.message, 'bad');
      }
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
      return;
    }
    if (action === 'bring-car') {
      const carId = el.dataset.car ?? '';
      const blocked = host.world.bringVehicle(carId);
      if (blocked) {
        host.say(blocked, 'bad');
        return;
      }
      host.close();
      return;
    }
    if (action === 'open-garage') {
      const carId = el.dataset.car ?? '';
      host.openApp('garage', `car:${carId}`);
      return;
    }
  },
};
