import type { FlightDetails, FlightCameraView, FlightPhase, RideDetails, RideCameraView } from './TransitTypes';

export class TransitHUD {
  private container: HTMLDivElement;
  private flightCardEl!: HTMLDivElement;
  private flightCameraNavEl!: HTMLDivElement;
  private rideCardEl!: HTMLDivElement;
  private rideCameraNavEl!: HTMLDivElement;

  // Callbacks
  public onSelectFlightCamera?: (view: FlightCameraView) => void;
  public onSelectRideCamera?: (view: RideCameraView) => void;
  public onSkipFlight?: () => void;
  public onSkipRide?: () => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'transit-hud-root';
    this.container.className = 'transit-hud-layer';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <!-- 1. FLIGHT HUD CARD (Top-Left) -->
      <div class="transit-flight-card" id="flight-hud-card" style="display: none;">
        <div class="flight-meta-top">
          <span class="flight-code" id="f-hud-code">NL 526 · Economy</span>
          <span class="flight-tail" id="f-hud-tail">5N-NGL</span>
        </div>
        <div class="flight-route-row">
          <span class="route-origin" id="f-hud-origin">LOS</span>
          <span class="route-arrow">⟶</span>
          <span class="route-dest" id="f-hud-dest">PHC</span>
        </div>
        <div class="flight-progress-bar">
          <div class="flight-fill" id="f-hud-progress-fill" style="width: 35%;"></div>
        </div>
        <div class="flight-status-time" id="f-hud-time">46 min to landing</div>
        <div class="flight-announcement-box" id="f-hud-subtext">
          <span class="speaker-icon">📢</span>
          <span id="f-hud-announcement">"Through the clouds. The seatbelt sign is off."</span>
        </div>
        <div class="flight-catering-row">
          <button class="btn-catering" id="btn-eat-chops">🥟 Small Chops</button>
          <button class="btn-catering" id="btn-drink-zobo">🍷 Cold Zobo</button>
          <button class="btn-flight-skip" id="btn-flight-skip">Skip flight ⏭️</button>
        </div>
      </div>

      <!-- 2. FLIGHT CAMERA PILLS (Bottom-Center) -->
      <nav class="flight-camera-bar" id="flight-camera-bar" style="display: none;">
        <button class="cam-pill-btn" data-fcam="outside">
          <span>✈️ Outside</span>
        </button>
        <button class="cam-pill-btn" data-fcam="cabin">
          <span>👥 Cabin</span>
        </button>
        <button class="cam-pill-btn active" data-fcam="seat">
          <span>💺 My seat</span>
        </button>
      </nav>

      <!-- 3. ROAD RIDE HUD CARD (Top-Left) -->
      <div class="transit-ride-card" id="ride-hud-card" style="display: none;">
        <div class="ride-header">
          <h3 id="r-hud-title">Mercedes G-Wagon · PH International Airport ⟶ Trans-Amadi</h3>
          <div class="ride-badges">
            <span class="ride-badge go-slow" id="r-hud-badge-traffic">Go-slow</span>
            <span class="ride-badge weather" id="r-hud-badge-weather">Sunny</span>
          </div>
        </div>
        <div class="ride-timer-row">
          <span class="ride-time-eta" id="r-hud-eta">0:04 to destination</span>
          <span class="ride-shift-time">Shift started · Home at 10:28 AM</span>
        </div>
        <p class="ride-subtext" id="r-hud-subtext">Almost there. Trans-Amadi Oil Base is just ahead.</p>
        <div class="ride-actions">
          <button class="btn-ride-skip" id="btn-ride-skip">Skip ride &gt;</button>
          <button class="btn-ride-back" id="btn-ride-back">Turn back</button>
        </div>
      </div>

      <!-- 4. RIDE CAMERA SWITCHER (Right-Side Vertical Pills) -->
      <nav class="ride-camera-bar" id="ride-camera-bar" style="display: none;">
        <button class="ride-cam-btn" data-rcam="chase">
          <span class="cam-icon">🚗</span>
          <span>Chase</span>
        </button>
        <button class="ride-cam-btn" data-rcam="side">
          <span class="cam-icon">👀</span>
          <span>Side</span>
        </button>
        <button class="ride-cam-btn active" data-rcam="inside">
          <span class="cam-icon">🚘</span>
          <span>Inside</span>
        </button>
      </nav>
    `;

    document.body.appendChild(this.container);

    this.flightCardEl = document.getElementById('flight-hud-card') as HTMLDivElement;
    this.flightCameraNavEl = document.getElementById('flight-camera-bar') as HTMLDivElement;
    this.rideCardEl = document.getElementById('ride-hud-card') as HTMLDivElement;
    this.rideCameraNavEl = document.getElementById('ride-camera-bar') as HTMLDivElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Flight camera pills
    this.flightCameraNavEl.querySelectorAll('.cam-pill-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.flightCameraNavEl.querySelectorAll('.cam-pill-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const view = target.getAttribute('data-fcam') as FlightCameraView;
        if (view) this.onSelectFlightCamera?.(view);
      });
    });

    // Ride camera pills
    this.rideCameraNavEl.querySelectorAll('.ride-cam-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.rideCameraNavEl.querySelectorAll('.ride-cam-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const view = target.getAttribute('data-rcam') as RideCameraView;
        if (view) this.onSelectRideCamera?.(view);
      });
    });

    // Skip flight & ride
    document.getElementById('btn-flight-skip')?.addEventListener('click', () => {
      this.onSkipFlight?.();
    });

    document.getElementById('btn-ride-skip')?.addEventListener('click', () => {
      this.onSkipRide?.();
    });

    // In-flight snacks
    document.getElementById('btn-eat-chops')?.addEventListener('click', () => {
      alert('🥟 You enjoyed hot puff-puff and samosa small chops! Energy +20');
    });

    document.getElementById('btn-drink-zobo')?.addEventListener('click', () => {
      alert('🍷 Chilled Zobo with ginger and pineapple! Happiness +15');
    });

    document.getElementById('btn-ride-back')?.addEventListener('click', () => {
      this.onSkipRide?.();
    });
  }

  // =========================================================================
  // FLIGHT HUD CONTROLS
  // =========================================================================
  public showFlightHUD(flight: FlightDetails): void {
    this.container.style.display = 'block';
    this.flightCardEl.style.display = 'block';
    this.flightCameraNavEl.style.display = 'flex';
    this.rideCardEl.style.display = 'none';
    this.rideCameraNavEl.style.display = 'none';

    const codeEl = document.getElementById('f-hud-code');
    const tailEl = document.getElementById('f-hud-tail');
    const origEl = document.getElementById('f-hud-origin');
    const destEl = document.getElementById('f-hud-dest');

    if (codeEl) codeEl.textContent = `${flight.flightCode || 'NL 526'} · ${flight.travelClass || 'Economy'}`;
    if (tailEl) tailEl.textContent = flight.tailNumber || '5N-NGL';
    if (origEl) origEl.textContent = flight.originCode;
    if (destEl) destEl.textContent = flight.destinationCode;
  }

  public updateFlightProgress(phase: FlightPhase, timeRemainingSec: number, announcement: string): void {
    const timeEl = document.getElementById('f-hud-time');
    const annEl = document.getElementById('f-hud-announcement');
    const fillEl = document.getElementById('f-hud-progress-fill');

    if (annEl) annEl.textContent = `"${announcement}"`;

    if (phase === 'boarding') {
      if (timeEl) timeEl.textContent = `Boarding · Gate 4 · ${Math.round(timeRemainingSec)}s`;
      if (fillEl) fillEl.style.width = '10%';
    } else if (phase === 'cruise') {
      if (timeEl) timeEl.textContent = `${Math.round(timeRemainingSec)} min to landing`;
      if (fillEl) fillEl.style.width = '65%';
    } else if (phase === 'landing') {
      if (timeEl) timeEl.textContent = `Touching down · 4 min`;
      if (fillEl) fillEl.style.width = '95%';
    }
  }

  public hideFlightHUD(): void {
    this.flightCardEl.style.display = 'none';
    this.flightCameraNavEl.style.display = 'none';
    if (this.rideCardEl.style.display === 'none') {
      this.container.style.display = 'none';
    }
  }

  // =========================================================================
  // ROAD RIDE HUD CONTROLS
  // =========================================================================
  public showRideHUD(ride: RideDetails): void {
    this.container.style.display = 'block';
    this.rideCardEl.style.display = 'block';
    this.rideCameraNavEl.style.display = 'flex';
    this.flightCardEl.style.display = 'none';
    this.flightCameraNavEl.style.display = 'none';

    const titleEl = document.getElementById('r-hud-title');
    const trafficEl = document.getElementById('r-hud-badge-traffic');
    const weatherEl = document.getElementById('r-hud-badge-weather');
    const subEl = document.getElementById('r-hud-subtext');

    if (titleEl) titleEl.textContent = `${ride.vehicleName} · ${ride.originName} ⟶ ${ride.destinationName}`;
    if (trafficEl) trafficEl.textContent = ride.trafficCondition;
    if (weatherEl) weatherEl.textContent = ride.weatherCondition;
    if (subEl) subEl.textContent = `Almost there. ${ride.destinationName} is just ahead.`;
  }

  public updateRideProgress(timeRemainingSec: number): void {
    const etaEl = document.getElementById('r-hud-eta');
    if (etaEl) {
      const mins = Math.floor(timeRemainingSec / 60);
      const secs = Math.floor(timeRemainingSec % 60);
      etaEl.textContent = `${mins}:${secs.toString().padStart(2, '0')} to destination`;
    }
  }

  public hideRideHUD(): void {
    this.rideCardEl.style.display = 'none';
    this.rideCameraNavEl.style.display = 'none';
    if (this.flightCardEl.style.display === 'none') {
      this.container.style.display = 'none';
    }
  }

  public setFlightCameraActive(view: FlightCameraView): void {
    this.flightCameraNavEl.querySelectorAll('.cam-pill-btn').forEach((b) => {
      if (b.getAttribute('data-fcam') === view) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  public setRideCameraActive(view: RideCameraView): void {
    this.rideCameraNavEl.querySelectorAll('.ride-cam-btn').forEach((b) => {
      if (b.getAttribute('data-rcam') === view) b.classList.add('active');
      else b.classList.remove('active');
    });
  }
}
