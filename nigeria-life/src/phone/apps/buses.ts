import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty } from '../../ui/kit/html';
import { BUS_CONDUCTOR_WAGE, BUS_DRIVER_WAGE, BUS_PRICE_NAIRA, BUS_ROUTES, BUS_SERVICE_NAIRA, BusLine } from '../../life/BusLine';

export const busesApp: PhoneApp = {
  id: 'buses',
  name: 'Buses',
  icon: '🚌',
  tint: ['#1e3a8a', '#fbbf24'],
  purpose: 'Your buses, their routes, the crew and the day’s takings',

  render(host) {
    const line = BusLine.get();
    const owned = line.buses();
    const purse = line.purse();
    return {
      title: 'Buses',
      body: `
        <div class="nl-hero">
          <span class="nl-hero-label">Takings waiting · ${esc(host.world.cityName())}</span>
          <span class="nl-hero-value">${naira(purse)}</span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-act="collect" ${purse > 0 ? '' : 'disabled'}>Collect into bank</button>
          </div>
        </div>
        <div class="nl-section">Your fleet</div>
        <div class="nl-list" id="bus-fleet">
          ${owned.length === 0
            ? empty('🚌', 'No bus yet', 'Buy one for a route. It runs and earns while you are away, once the crew is on.')
            : owned.map((bus) => {
                const route = line.route(bus.routeId);
                const running = bus.driver && bus.conductor && bus.condition >= 20;
                return row({
                  icon: '🚌',
                  title: esc(route?.name ?? bus.routeId),
                  sub: `${running ? 'On the route' : 'Parked'} · condition ${bus.condition}%${bus.driver ? ' · driver' : ''}${bus.conductor ? ' · conductor' : ''}`,
                  trailing: `<span class="nl-stack">
                    ${bus.driver ? '' : `<button class="nl-btn nl-btn--sm" data-act="hire" data-arg="${esc(bus.id)}|driver">Driver ${naira(BUS_DRIVER_WAGE)}</button>`}
                    ${bus.conductor ? '' : `<button class="nl-btn nl-btn--sm" data-act="hire" data-arg="${esc(bus.id)}|conductor">Conductor ${naira(BUS_CONDUCTOR_WAGE)}</button>`}
                    <button class="nl-btn nl-btn--sm" data-act="service" data-arg="${esc(bus.id)}">Service ${naira(BUS_SERVICE_NAIRA)}</button>
                  </span>`,
                });
              }).join('')}
        </div>
        <div class="nl-section">Routes</div>
        <div class="nl-list" id="bus-routes">
          ${BUS_ROUTES.map((route) => {
            const taken = owned.some((b) => b.routeId === route.id);
            return row({
              icon: '🛣️',
              title: esc(route.name),
              sub: `${esc(route.cityId === 'port_harcourt' ? 'Port Harcourt' : route.cityId === 'abuja' ? 'Abuja' : 'Lagos')} · fare ${naira(route.fare)} · about ${route.anHour} passengers an hour`,
              trailing: taken ? '<span class="nl-tag">Yours</span>' : `<button class="nl-btn nl-btn--sm" data-act="buy" data-arg="${esc(route.id)}">Buy ${naira(BUS_PRICE_NAIRA)}</button>`,
            });
          }).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    const arg = el.dataset.arg ?? '';
    const line = BusLine.get();
    if (action === 'buy') {
      const result = line.buy(arg);
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
      return;
    }
    if (action === 'hire') {
      const [id, who] = arg.split('|');
      const result = line.hire(id, who === 'conductor' ? 'conductor' : 'driver');
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
      return;
    }
    if (action === 'service') {
      const result = line.service(arg);
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
      return;
    }
    if (action === 'collect') {
      const result = line.collect();
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
    }
  },
};
