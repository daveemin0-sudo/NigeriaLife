import type { DistrictData, MapLandmark, MapProperty } from '../world/data/WorldDataTypes';
import { WorldDataManager } from '../world/data/WorldDataManager';
import { BackendService } from '../backend/BackendService';

export class WorldMapUI {
  private container: HTMLDivElement;
  private cardEl: HTMLDivElement;
  private districtChipsEl: HTMLDivElement;

  public onTravelToDistrict?: (district: DistrictData) => void;
  public onTravelToProperty?: (property: MapProperty) => void;
  public onPropertyUpdated?: (propertyId: string) => void;
  public onInterstateTravel?: (destCityId: string) => void;
  public onSelectDistrictFromChips?: (districtId: string) => void;
  public onCloseMap?: () => void;
  public onSwitchCityTab?: (cityId: string) => void;
  public onOpenEconomy?: (propertyId: string) => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'world-map-ui-root';
    this.container.className = 'world-map-ui-layer';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <!-- TOP STATUS BAR (World Map Header) -->
      <header class="map-top-bar">
        <div class="map-top-left">
          <div class="map-city-badge">
            <span class="flag">🇳🇬</span>
            <div class="city-meta">
              <span class="city-name" id="map-ui-city-name">LAGOS STATE</span>
              <span class="city-tagline">Commercial Capital • 11 Districts</span>
            </div>
          </div>
        </div>

        <div class="map-top-center">
          <div class="map-stat-pill">
            <span>☀️</span>
            <span id="map-ui-time">Wed 7 • 1:18 PM</span>
          </div>
          <div class="map-stat-pill">
            <span>😄</span>
            <span>Happiness: <strong>98%</strong></span>
          </div>
          <div class="map-stat-pill">
            <span>👥</span>
            <span>Online: <strong style="color: #4ade80;">85,420</strong></span>
          </div>
          <div class="map-stat-pill money-stat">
            <span id="map-ui-money">₦25,000</span>
          </div>
        </div>

        <div class="map-top-right">
          <button class="btn-map-close" id="btn-map-back-street">
            <span>🚶</span>
            <span>Return to Street</span>
          </button>
        </div>
      </header>

      <!-- CITY NAVIGATION TABS (Lagos / Abuja / Port Harcourt) -->
      <nav class="map-city-tabs">
        <button class="city-nav-tab active" data-city="lagos">🏖️ Lagos (Active)</button>
        <button class="city-nav-tab" data-city="abuja">⛰️ Abuja FCT</button>
        <button class="city-nav-tab" data-city="port_harcourt">🛢️ Port Harcourt</button>
      </nav>

      <!-- DISTRICT QUICK CHIP NAVIGATOR -->
      <div class="map-district-strip" id="map-district-chips">
        <!-- Rendered dynamically -->
      </div>

      <!-- MAP CONTEXTUAL INFO CARD (District / Landmark / Property / Airport) -->
      <div class="map-context-card" id="map-context-card" style="display: none;">
        <button class="card-close-x" id="map-card-close">&times;</button>
        <div class="card-tag-row">
          <span class="card-chip" id="map-card-chip">DISTRICT</span>
          <span class="card-zone" id="map-card-zone">Mainland</span>
        </div>
        <h2 class="card-name" id="map-card-name">Lekki Phase 1</h2>
        <p class="card-sub" id="map-card-sub">Residential & Luxury District</p>
        <p class="card-desc" id="map-card-desc">High-end estates, beach clubs, and vibrant restaurant life.</p>
        
        <div class="card-stats-grid" id="map-card-stats">
          <div class="stat-col">
            <span class="stat-num" id="map-stat-pop">1.2M</span>
            <span class="stat-lbl" id="map-stat-lbl-1">Population</span>
          </div>
          <div class="stat-col">
            <span class="stat-num" id="map-stat-props">2,800</span>
            <span class="stat-lbl" id="map-stat-lbl-2">Properties</span>
          </div>
          <div class="stat-col">
            <span class="stat-num" id="map-stat-biz">1,100</span>
            <span class="stat-lbl" id="map-stat-lbl-3">Businesses</span>
          </div>
        </div>

        <div class="card-action-btns" id="map-card-actions">
          <button class="btn-primary-action" id="btn-map-travel">🚶 Travel & Walk Here</button>
        </div>
      </div>

      <!-- MAP CONTROLS HINT OVERLAY -->
      <div class="map-controls-hint">
        <span>🖱️ Drag to Pan Map • Scroll Wheel to Zoom • Click any District / Landmark for Details</span>
      </div>
    `;

    document.body.appendChild(this.container);

    this.cardEl = document.getElementById('map-context-card') as HTMLDivElement;
    this.districtChipsEl = document.getElementById('map-district-chips') as HTMLDivElement;

    this.initEventListeners();
    this.renderDistrictChips();

    // Subscribe to live backend cash updates
    BackendService.getInstance().subscribe((account) => {
      const moneyEl = document.getElementById('map-ui-money');
      if (moneyEl) moneyEl.textContent = `₦${account.walletCash.toLocaleString()}`;
    });
  }

  private initEventListeners(): void {
    document.getElementById('btn-map-back-street')?.addEventListener('click', () => {
      this.close();
      this.onCloseMap?.();
    });

    document.getElementById('map-card-close')?.addEventListener('click', () => {
      this.cardEl.style.display = 'none';
    });

    // City tabs
    this.container.querySelectorAll('.city-nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        this.container.querySelectorAll('.city-nav-tab').forEach((t) => t.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const cityId = target.getAttribute('data-city');
        if (cityId) this.onSwitchCityTab?.(cityId);
      });
    });
  }

  private renderDistrictChips(): void {
    const districts = WorldDataManager.getInstance().getDistricts();
    this.districtChipsEl.innerHTML = '';

    districts.forEach((d) => {
      const btn = document.createElement('button');
      btn.className = 'district-chip-btn';
      btn.textContent = d.name;
      btn.addEventListener('click', () => {
        this.onSelectDistrictFromChips?.(d.id);
        this.showDistrictDetails(d);
      });
      this.districtChipsEl.appendChild(btn);
    });
  }

  public showDistrictDetails(d: DistrictData): void {
    const chip = document.getElementById('map-card-chip');
    const zone = document.getElementById('map-card-zone');
    const name = document.getElementById('map-card-name');
    const sub = document.getElementById('map-card-sub');
    const desc = document.getElementById('map-card-desc');
    const pop = document.getElementById('map-stat-pop');
    const props = document.getElementById('map-stat-props');
    const biz = document.getElementById('map-stat-biz');
    const lbl1 = document.getElementById('map-stat-lbl-1');
    const lbl2 = document.getElementById('map-stat-lbl-2');
    const lbl3 = document.getElementById('map-stat-lbl-3');
    const actions = document.getElementById('map-card-actions');

    if (lbl1) lbl1.textContent = 'Population';
    if (lbl2) lbl2.textContent = 'Properties';
    if (lbl3) lbl3.textContent = 'Businesses';

    if (chip) chip.textContent = 'DISTRICT';
    if (zone) zone.textContent = d.zone;
    if (name) name.textContent = d.name;
    if (sub) sub.textContent = d.subtitle;
    if (desc) desc.textContent = d.description;
    if (pop) pop.textContent = d.populationEstimate;
    if (props) props.textContent = `${d.propertyCount.toLocaleString()}`;
    if (biz) biz.textContent = `${d.businessCount.toLocaleString()}`;

    if (actions) {
      actions.innerHTML = `
        <button class="btn-primary-action" id="btn-card-travel-dest">🚶 Walk Street in ${d.name}</button>
      `;
      document.getElementById('btn-card-travel-dest')?.addEventListener('click', () => {
        this.onTravelToDistrict?.(d);
      });
    }

    this.cardEl.style.display = 'block';
  }

  public showLandmarkDetails(lm: MapLandmark): void {
    const chip = document.getElementById('map-card-chip');
    const zone = document.getElementById('map-card-zone');
    const name = document.getElementById('map-card-name');
    const sub = document.getElementById('map-card-sub');
    const desc = document.getElementById('map-card-desc');
    const pop = document.getElementById('map-stat-pop');
    const props = document.getElementById('map-stat-props');
    const biz = document.getElementById('map-stat-biz');
    const lbl1 = document.getElementById('map-stat-lbl-1');
    const lbl2 = document.getElementById('map-stat-lbl-2');
    const lbl3 = document.getElementById('map-stat-lbl-3');
    const actions = document.getElementById('map-card-actions');

    if (lbl1) lbl1.textContent = 'Category';
    if (lbl2) lbl2.textContent = 'Location';
    if (lbl3) lbl3.textContent = 'Status';

    if (chip) chip.textContent = lm.icon + ' LANDMARK';
    if (zone) zone.textContent = lm.type.toUpperCase();
    if (name) name.textContent = lm.title;
    if (sub) sub.textContent = lm.subtitle;
    if (desc) desc.textContent = lm.description;
    if (pop) pop.textContent = 'Active POI';
    if (props) props.textContent = 'Lagos State';
    if (biz) biz.textContent = 'Open 24/7';

    if (actions) {
      actions.innerHTML = '';
      lm.actions.forEach((act) => {
        const btn = document.createElement('button');
        btn.className = 'btn-primary-action';
        btn.textContent = act.label;
        btn.addEventListener('click', () => {
          if (act.actionType === 'interstate' && act.targetId) {
            this.onInterstateTravel?.(act.targetId);
          } else if (act.actionType === 'travel') {
            const d = WorldDataManager.getInstance().getDistrictById(lm.districtId);
            if (d) this.onTravelToDistrict?.(d);
          } else {
            alert(`Opening ${lm.title} details.`);
          }
        });
        actions.appendChild(btn);
      });
    }

    this.cardEl.style.display = 'block';
  }

  public showPropertyDetails(p: MapProperty): void {
    const chip = document.getElementById('map-card-chip');
    const zone = document.getElementById('map-card-zone');
    const name = document.getElementById('map-card-name');
    const sub = document.getElementById('map-card-sub');
    const desc = document.getElementById('map-card-desc');
    const pop = document.getElementById('map-stat-pop');
    const props = document.getElementById('map-stat-props');
    const biz = document.getElementById('map-stat-biz');
    const lbl1 = document.getElementById('map-stat-lbl-1');
    const lbl2 = document.getElementById('map-stat-lbl-2');
    const lbl3 = document.getElementById('map-stat-lbl-3');
    const actions = document.getElementById('map-card-actions');

    const district = WorldDataManager.getInstance().getDistrictById(p.districtId);
    const districtName = district ? district.name : p.districtId;

    if (lbl1) lbl1.textContent = 'Purchase Price';
    if (lbl2) lbl2.textContent = 'Monthly Rent';
    if (lbl3) lbl3.textContent = 'Status';

    if (chip) chip.textContent = `${p.icon || '🏠'} PROPERTY`;
    if (zone) zone.textContent = districtName;
    if (name) name.textContent = p.name;
    if (sub) sub.textContent = `Type: ${p.type.toUpperCase()} • Status: ${p.status.toUpperCase()}`;
    if (desc) desc.textContent = `${p.description || ''}${p.features?.length ? ' • ' + p.features.join(' • ') : ''}`;
    if (pop) pop.textContent = `₦${p.price.toLocaleString()}`;
    if (props) props.textContent = `₦${p.rentPrice.toLocaleString()}/mo`;
    if (biz) biz.textContent = p.status === 'owned' && p.ownerId === 'player' ? 'Owned by You' : p.status.toUpperCase();

    if (actions) {
      const isOwned = p.status === 'owned' && p.ownerId === 'player';
      const isRented = p.status === 'rented' && p.ownerId === 'player';

      actions.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          <button class="btn-primary-action" id="btn-card-prop-view" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
            🚶 Walk Street Here
          </button>
          <div style="display: flex; gap: 8px; width: 100%;">
            <button class="btn-primary-action" id="btn-card-prop-buy" style="flex: 1; background: ${isOwned ? '#334155' : 'linear-gradient(135deg, #16a34a, #15803d)'}; cursor: ${isOwned ? 'default' : 'pointer'};" ${isOwned ? 'disabled' : ''}>
              ${isOwned ? '✅ Owned' : `📜 Buy (₦${p.price.toLocaleString()})`}
            </button>
            <button class="btn-primary-action" id="btn-card-prop-rent" style="flex: 1; background: ${isRented ? '#334155' : 'linear-gradient(135deg, #d97706, #b45309)'}; cursor: ${isRented ? 'default' : 'pointer'};" ${isRented || isOwned ? 'disabled' : ''}>
              ${isRented ? '🔑 Rented' : isOwned ? '🏠 (Owned)' : `🔑 Rent (₦${p.rentPrice.toLocaleString()})`}
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-card-prop-view')?.addEventListener('click', () => {
        this.onTravelToProperty?.(p);
      });

      document.getElementById('btn-card-prop-buy')?.addEventListener('click', () => {
        const res = BackendService.getInstance().buyProperty(p.id);
        alert(res.message);
        if (res.success) {
          const updated = WorldDataManager.getInstance().getPropertyById(p.id);
          if (updated) this.showPropertyDetails(updated);
          this.onPropertyUpdated?.(p.id);
        }
      });

      document.getElementById('btn-card-prop-rent')?.addEventListener('click', () => {
        const res = BackendService.getInstance().rentProperty(p.id);
        alert(res.message);
        if (res.success) {
          const updated = WorldDataManager.getInstance().getPropertyById(p.id);
          if (updated) this.showPropertyDetails(updated);
          this.onPropertyUpdated?.(p.id);
        }
      });
    }

    this.cardEl.style.display = 'block';
  }

  public open(): void {
    this.container.style.display = 'block';
  }

  public close(): void {
    this.container.style.display = 'none';
    this.cardEl.style.display = 'none';
  }
}
