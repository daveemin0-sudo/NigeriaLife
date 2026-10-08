import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import { NIGERIA_CITIES_REGISTRY } from '../cities/CityRegistry';
import type { CityId, CityTravelRoute } from '../cities/CityTypes';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';

export class InterStateModal {
  private container: HTMLDivElement;
  private backend: BackendService;
  public isOpen: boolean = false;
  private isTraveling: boolean = false;

  public currentOriginCityId: CityId = 'lagos';
  public onInterStateTravelCompleted?: (destinationId: CityId) => void;
  public onStartTravelSimulation?: (
    route: CityTravelRoute,
    fare: number,
    onCompleted: (destId: CityId) => void
  ) => void;

  constructor() {
    this.backend = BackendService.getInstance();
    this.container = document.createElement('div');
    this.container.id = 'interstate-modal';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);

    this.backend.subscribe(this.render.bind(this));
    this.setupGlobalShortcuts();
  }

  private setupGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.toggle();
      }
    });
  }

  public open(originCityId?: CityId): void {
    if (this.isTraveling) return;
    if (originCityId) this.currentOriginCityId = originCityId;
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.render(this.backend.getData());
    UIStateManager.getInstance().pushModal('interstate');
  }

  public close(): void {
    if (this.isTraveling) return;
    this.isOpen = false;
    this.container.style.display = 'none';
    UIStateManager.getInstance().popModal('interstate');
  }

  public toggle(originCityId?: CityId): void {
    if (this.isOpen) this.close();
    else this.open(originCityId);
  }

  private render(data: PlayerAccount): void {
    if (!this.isOpen) return;

    const origin = NIGERIA_CITIES_REGISTRY[this.currentOriginCityId];
    const routes = origin.routes;

    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="interstate-dialog">
        <header class="dialog-header">
          <div class="dialog-title-wrap">
            <span class="dialog-badge">FEDERAL REPUBLIC OF NIGERIA • INTER-STATE FEDERATION</span>
            <h2>✈️ Nigerian Inter-State Flights & Luxury Coach Terminal</h2>
            <p>Seamless cross-country transit between Lagos State, Abuja FCT, and geopolitical zones.</p>
          </div>
          <button class="dialog-close-btn" id="interstate-close-btn">&times;</button>
        </header>

        <!-- Current State Info Banner -->
        <div class="interstate-origin-banner">
          <div class="origin-flag">🇳🇬</div>
          <div class="origin-meta">
            <h4>Current Location: <strong>${origin.name}</strong> (${origin.zone} Zone)</h4>
            <p>${origin.tagline} • Pocket: <strong>₦${data.walletCash.toLocaleString()}</strong> • Bank: <strong>₦${data.bank.balance.toLocaleString()}</strong></p>
          </div>
        </div>

        <!-- Available Interstate Routes -->
        <div class="interstate-routes-grid">
          ${routes.map((route) => {
            const dest = NIGERIA_CITIES_REGISTRY[route.destinationId];
            const isFlight = route.mode === 'flight';
            return `
              <div class="route-card ${isFlight ? 'flight-card' : 'bus-card'}">
                <div class="route-header">
                  <div class="route-operator">
                    <span class="operator-icon">${isFlight ? '✈️' : '🚌'}</span>
                    <div>
                      <h4>${route.airlineOrOperator}</h4>
                      <span class="route-code">${route.flightOrBusCode}</span>
                    </div>
                  </div>
                  <span class="route-fare">₦${route.fare.toLocaleString()}</span>
                </div>

                <div class="route-stations">
                  <div class="station-row">
                    <span class="dot departure"></span>
                    <span><strong>From:</strong> ${route.departureStation}</span>
                  </div>
                  <div class="station-row">
                    <span class="dot arrival"></span>
                    <span><strong>To:</strong> ${dest.name} (${route.arrivalStation})</span>
                  </div>
                </div>

                <div class="route-perk">
                  <span>✨ Travel Perk:</span> ${route.perkDescription}
                </div>

                <button class="btn-book-route" data-dest-id="${route.destinationId}" data-fare="${route.fare}">
                  ${isFlight ? '✈️ Book Flight Ticket' : '🚌 Board Luxury Coach'} (₦${route.fare.toLocaleString()})
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Travel In-Progress Animated Journey Screen -->
        <div class="flight-journey-screen" id="flight-journey-screen" style="display: none;">
          <div class="flight-journey-content">
            <div class="flight-plane-anim" id="journey-plane-anim">✈️💨</div>
            <h3 id="flight-headline">Wazobia Air Flight Airborne...</h3>
            <p id="flight-subtext">"Cabin crew, prepare for takeoff. Cruising altitude 32,000 feet."</p>
            <div class="flight-progress-bar">
              <div class="flight-progress-fill" id="flight-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEvents(routes);
  }

  private setupEvents(routes: CityTravelRoute[]): void {
    const closeBtn = document.getElementById('interstate-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) (backdrop as HTMLElement).onclick = () => this.close();

    this.container.querySelectorAll('.btn-book-route').forEach((btn) => {
      btn.addEventListener('click', () => {
        const destId = (btn as HTMLElement).getAttribute('data-dest-id') as CityId;
        const fare = parseInt((btn as HTMLElement).getAttribute('data-fare') || '0', 10);
        const route = routes.find((r) => r.destinationId === destId);
        if (route) {
          this.executeInterStateTravel(route, fare);
        }
      });
    });
  }

  private executeInterStateTravel(route: CityTravelRoute, fare: number): void {
    // Pay fare: wallet first, bank covers any shortfall
    if (!this.backend.pay(fare, `${route.airlineOrOperator} Interstate Ticket`, 'TRAVEL_COST')) {
      showGameToast(`❌ Insufficient funds! You need ₦${fare.toLocaleString()} to book this interstate ticket.`, 'error');
      return;
    }

    // Add boarding pass / souvenir to bag
    this.backend.addItem({
      id: `${route.souvenirItem.id}_${Date.now()}`,
      name: route.souvenirItem.name,
      category: 'document',
      icon: route.souvenirItem.icon,
      description: route.souvenirItem.description,
      price: fare,
      usable: false,
    });
    this.backend.addStreetCred(30);

    // If full 3D interactive flight/road transit simulation is hooked:
    if (this.onStartTravelSimulation) {
      this.isTraveling = true;
      this.close();
      this.onStartTravelSimulation(route, fare, (destId) => {
        this.isTraveling = false;
        this.currentOriginCityId = destId;
        this.onInterStateTravelCompleted?.(destId);
      });
      return;
    }

    this.isTraveling = true;
    const screen = document.getElementById('flight-journey-screen');
    const plane = document.getElementById('journey-plane-anim');
    const headline = document.getElementById('flight-headline');
    const subtext = document.getElementById('flight-subtext');
    const fill = document.getElementById('flight-progress-fill');

    if (screen && plane && headline && subtext && fill) {
      screen.style.display = 'flex';
      plane.textContent = route.mode === 'flight' ? '✈️💨' : '🚌💨';
      headline.textContent = `${route.airlineOrOperator} En Route to ${route.destinationId.toUpperCase()}...`;
      subtext.textContent = route.mode === 'flight'
        ? '"Cabin crew prepare cabin for landing. Welcome to the Federal Capital Territory."'
        : '"Cruising on the Federal Express highway with AC & Afrobeats radio."';
      fill.style.width = '0%';

      setTimeout(() => {
        fill.style.width = '100%';
      }, 50);

      setTimeout(() => {
        // Trip completion
        this.isTraveling = false;
        screen.style.display = 'none';
        this.currentOriginCityId = route.destinationId;
        this.close();

        // Add boarding pass / souvenir to bag
        this.backend.addItem({
          id: `${route.souvenirItem.id}_${Date.now()}`,
          name: route.souvenirItem.name,
          category: 'document',
          icon: route.souvenirItem.icon,
          description: route.souvenirItem.description,
          price: fare,
          usable: false,
        });

        this.backend.addStreetCred(30);

        this.onInterStateTravelCompleted?.(route.destinationId);

        showGameToast(
          `🇳🇬 Arrived in ${route.destinationId.toUpperCase()}! Added "${route.souvenirItem.name}" to bag! Street Cred +30!`,
          'success'
        );
      }, route.durationSeconds * 1000);
    }
  }
}
