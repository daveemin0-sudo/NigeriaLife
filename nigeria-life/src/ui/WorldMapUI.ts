import type { DistrictData, MapLandmark, MapProperty } from '../world/data/WorldDataTypes';
import { WorldDataManager } from '../world/data/WorldDataManager';
import { BackendService } from '../backend/BackendService';
import { DestinationRegistry } from '../destinations/DestinationRegistry';
import type { DestinationDefinition, TransportOption } from '../destinations/DestinationTypes';
import { showGameToast } from './GameToast';

export class WorldMapUI {
  private container: HTMLDivElement;
  private cardEl: HTMLDivElement;
  private districtChipsEl: HTMLDivElement;

  public onTravelToDistrict?: (district: DistrictData) => void;
  public onTravelToProperty?: (property: MapProperty) => void;
  public onTravelWithTransport?: (dest: DestinationDefinition, transport: TransportOption) => void;
  public onPropertyUpdated?: (propertyId: string) => void;
  public onInterstateTravel?: (destCityId: string) => void;
  public onSelectDistrictFromChips?: (districtId: string) => void;
  public onCloseMap?: () => void;
  public onSwitchCityTab?: (cityId: string) => void;
  public onOpenEconomy?: (propertyId: string) => void;
  public onEnterInterior?: (buildingId: string) => void;

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

      <!-- MAP HOVER TOOLTIP (Vibrant Lagos Life building hover tooltip) -->
      <div class="map-hover-tooltip" id="map-hover-tooltip" style="display: none;">
        <span class="map-tt-icon" id="map-tt-icon">🏥</span>
        <div class="map-tt-body">
          <div class="map-tt-title" id="map-tt-title">Building Name</div>
          <div class="map-tt-sub" id="map-tt-sub">🟢 Open • Click to Enter Inside</div>
        </div>
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
        <span>🖱️ Drag to Pan Map • Scroll to Zoom • Hover over any building to see name • Click to Enter Inside</span>
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
        if (cityId) {
          this.updateCityHeader(cityId);
          this.onSwitchCityTab?.(cityId);
        }
      });
    });
  }

  public updateCityHeader(cityId: string): void {
    const cleanId = cityId.toLowerCase().replace(/[\s-]/g, '_');
    const nameEl = document.getElementById('map-ui-city-name');
    const tagEl = this.container.querySelector('.city-tagline');

    // Update active tab styling
    this.container.querySelectorAll('.city-nav-tab').forEach((t) => {
      const tabCity = t.getAttribute('data-city');
      if (tabCity === cleanId || (cleanId.includes('port') && tabCity === 'port_harcourt')) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    if (cleanId.includes('abuja')) {
      if (nameEl) nameEl.textContent = 'ABUJA FCT';
      if (tagEl) tagEl.textContent = 'Centre of Unity • Federal Seat of Power';
    } else if (cleanId.includes('port') || cleanId.includes('ph') || cleanId.includes('harcourt')) {
      if (nameEl) nameEl.textContent = 'PORT HARCOURT (GARDEN CITY)';
      if (tagEl) tagEl.textContent = 'Treasure Base of the Nation • Oil & Gas Capital';
    } else {
      if (nameEl) nameEl.textContent = 'LAGOS STATE';
      if (tagEl) tagEl.textContent = 'Commercial Capital • 11 Districts';
    }

    this.renderDistrictChips();
  }

  public renderDistrictChips(): void {
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

  public showHoverTooltip(
    item: { type: string; data: any } | null,
    screenPos: { x: number; y: number }
  ): void {
    const tt = document.getElementById('map-hover-tooltip');
    if (!tt) return;
    if (!item) {
      tt.style.display = 'none';
      return;
    }

    const iconEl = document.getElementById('map-tt-icon');
    const titleEl = document.getElementById('map-tt-title');
    const subEl = document.getElementById('map-tt-sub');

    let icon = '📍';
    let title = '';
    let sub = '🟢 Open • Click to Enter Inside';

    if (item.type === 'landmark') {
      const lm = item.data as MapLandmark;
      const canonicalDest = DestinationRegistry.getInstance().getById(lm.id);

      if (canonicalDest) {
        icon = canonicalDest.mapIcon || lm.icon || '📍';
        title = canonicalDest.name;
        sub = `${canonicalDest.category} • ${canonicalDest.districtName} • ${canonicalDest.shortDescription} • 🟢 ${canonicalDest.openingHours}`;
      } else {
        icon = lm.icon || '📍';
        title = lm.name || lm.title;
        if (lm.id === 'broad_street_banks') sub = '🏦 Commercial Bank • Click to View & Enter';
        else if (lm.id === 'mama_put_buka') sub = '🍲 Mama Put Buka • Click to View & Enter';
        else if (lm.id === 'lagos_area_command_police') sub = '👮 Police Command • Click to View & Enter';
        else sub = `${lm.title} • 🟢 Open`;
      }
    } else if (item.type === 'property') {
      const p = item.data as MapProperty;
      icon = p.icon || '🏠';
      title = p.name;
      sub = p.status === 'owned' 
        ? '🔑 Owned Residence • Click to Enter Inside' 
        : `₦${p.price.toLocaleString()} • Click to View & Buy`;
    }

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    const posX = Math.min(screenPos.x + 14, window.innerWidth - 300);
    const posY = Math.max(screenPos.y - 48, 16);
    tt.style.left = `${posX}px`;
    tt.style.top = `${posY}px`;
    tt.style.display = 'flex';
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

    const canonicalDest = DestinationRegistry.getInstance().getById(lm.id);

    if (canonicalDest) {
      if (lbl1) lbl1.textContent = 'Category';
      if (lbl2) lbl2.textContent = 'District';
      if (lbl3) lbl3.textContent = 'Status';

      if (chip) chip.textContent = `${canonicalDest.mapIcon} ${canonicalDest.category.toUpperCase()}`;
      if (zone) zone.textContent = canonicalDest.districtName;
      if (name) name.textContent = canonicalDest.name;
      if (sub) sub.textContent = `${canonicalDest.category} • ${canonicalDest.districtName}`;
      if (desc) desc.textContent = canonicalDest.destinationDescription;
      if (pop) pop.textContent = canonicalDest.category;
      if (props) props.textContent = canonicalDest.districtName;
      if (biz) biz.textContent = canonicalDest.openingHours;

      if (actions) {
        actions.innerHTML = `
          <!-- Services Badges -->
          <div style="display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 12px 0;">
            ${canonicalDest.services
              .map(
                (s) =>
                  `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">✓ ${s}</span>`
              )
              .join('')}
          </div>

          <!-- Transport Chooser Header -->
          <div style="margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>🚗</span> How would you like to get there?
            </div>
            <span style="font-size: 11px; color: #94a3b8;">Choose transport to travel directly outside ${canonicalDest.name}</span>
          </div>

          <!-- 7-Mode Transport List -->
          <div class="dest-transport-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 230px; overflow-y: auto; padding-right: 4px;">
            ${canonicalDest.transportAvailability
              .map(
                (t) => `
              <button class="btn-transport-row" data-mode="${t.mode}" style="display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 8px 12px; cursor: pointer; text-align: left; width: 100%; transition: background 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">${t.icon}</span>
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: #f1f5f9;">${t.label}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${t.description}</div>
                  </div>
                </div>
                <div style="text-align: right; min-width: 65px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${t.fare === 0 ? '#4ade80' : '#fbbf24'};">${t.fare === 0 ? 'FREE' : '₦' + t.fare.toLocaleString()}</div>
                  <div style="font-size: 10px; color: #64748b;">⏱️ ~${t.travelTimeSec}s</div>
                </div>
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Direct Actions -->
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn-primary-action" id="btn-card-direct-enter" style="flex: 1; background: linear-gradient(135deg, #10b981, #059669); font-weight: 800; font-size: 13px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);">
              🚪 Direct Enter Inside [E]
            </button>
            <button class="btn-primary-action" id="btn-card-walk-exterior" style="flex: 1; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 13px;">
              🚶 Walk Outside
            </button>
          </div>
        `;

        // Wire each transport row button
        canonicalDest.transportAvailability.forEach((t) => {
          const rowBtn = actions.querySelector(`[data-mode="${t.mode}"]`);
          rowBtn?.addEventListener('click', () => {
            this.close();
            this.onTravelWithTransport?.(canonicalDest, t);
          });
        });

        // Direct enter inside
        document.getElementById('btn-card-direct-enter')?.addEventListener('click', () => {
          this.close();
          this.onEnterInterior?.(canonicalDest.interiorId);
        });

        // Walk outside on street
        document.getElementById('btn-card-walk-exterior')?.addEventListener('click', () => {
          const walkOpt = canonicalDest.transportAvailability.find((o) => o.mode === 'walk') || {
            mode: 'walk' as const,
            label: 'Walk on Foot',
            icon: '🚶',
            fare: 0,
            travelTimeSec: 12,
            description: 'Walk on foot',
          };
          this.close();
          this.onTravelWithTransport?.(canonicalDest, walkOpt);
        });
      }
    } else {
      // Fallback for general landmarks without dedicated interior simulation
      if (lbl1) lbl1.textContent = 'Category';
      if (lbl2) lbl2.textContent = 'Location';
      if (lbl3) lbl3.textContent = 'Status';

      if (chip) chip.textContent = lm.icon + ' LANDMARK';
      if (zone) zone.textContent = lm.type.toUpperCase();
      if (name) name.textContent = lm.name || lm.title;
      if (sub) sub.textContent = lm.subtitle;
      if (desc) desc.textContent = lm.description;
      if (pop) pop.textContent = 'Active POI';
      if (props) props.textContent = 'Lagos State';
      if (biz) biz.textContent = 'Open 24/7';

      if (actions) {
        actions.innerHTML = `
          <button class="btn-primary-action" id="btn-card-walk-district" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
            🚶 Walk Outside on Street
          </button>
        `;
        document.getElementById('btn-card-walk-district')?.addEventListener('click', () => {
          const d = WorldDataManager.getInstance().getDistrictById(lm.districtId);
          if (d) this.onTravelToDistrict?.(d);
        });
      }
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
      const isResidential = ['house', 'duplex', 'apartment', 'room', 'luxury apartment'].includes(p.type);

      actions.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          ${isResidential ? `
            <button class="btn-primary-action" id="btn-card-prop-enter" style="background: linear-gradient(135deg, #10b981, #059669); font-weight: 800;">
              🚪 Enter Residence Inside
            </button>
          ` : ''}
          <button class="btn-primary-action" id="btn-card-prop-view" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
            🚶 Walk Street Outside
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

      if (isResidential) {
        document.getElementById('btn-card-prop-enter')?.addEventListener('click', () => {
          this.close();
          this.onEnterInterior?.('residence');
        });
      }

      document.getElementById('btn-card-prop-view')?.addEventListener('click', () => {
        this.onTravelToProperty?.(p);
      });

      document.getElementById('btn-card-prop-buy')?.addEventListener('click', () => {
        const res = BackendService.getInstance().buyProperty(p.id);
        showGameToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          const updated = WorldDataManager.getInstance().getPropertyById(p.id);
          if (updated) this.showPropertyDetails(updated);
          this.onPropertyUpdated?.(p.id);
        }
      });

      document.getElementById('btn-card-prop-rent')?.addEventListener('click', () => {
        const res = BackendService.getInstance().rentProperty(p.id);
        showGameToast(res.message, res.success ? 'success' : 'error');
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
    const tt = document.getElementById('map-hover-tooltip');
    if (tt) tt.style.display = 'none';
  }
}
