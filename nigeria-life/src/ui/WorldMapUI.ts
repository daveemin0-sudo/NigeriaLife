import * as THREE from 'three';
import type { DistrictData, MapLandmark, MapProperty } from '../world/data/WorldDataTypes';
import { WorldDataManager } from '../world/data/WorldDataManager';
import { BackendService } from '../backend/BackendService';
import { DestinationRegistry } from '../destinations/DestinationRegistry';
import type { DestinationDefinition, TransportOption } from '../destinations/DestinationTypes';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';

/** A label drawn over the map at a fixed map position */
interface MapMarker {
  el: HTMLElement;
  position: THREE.Vector3;
  /** The place a pin is for (area names have none) */
  place?: string;
  /** The pin stands over the real place in the city, not over a drawing of it */
  real?: boolean;
}

/** "Quilox VIP Nightclub & Waterfront Lounge" -> "Quilox VIP Nightclub" */
function shortPlaceName(name: string): string {
  return name.split(' (')[0].split(' & ')[0];
}

const CITY_LABEL: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };

/** How long a walk of so many metres takes at the pace the player walks */
function walkingTime(metres: number): string {
  const seconds = metres / 7.5;
  if (seconds < 55) return `${Math.max(5, Math.round(seconds / 5) * 5)} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export class WorldMapUI {
  private container: HTMLDivElement;
  private cardEl: HTMLDivElement;
  private districtChipsEl: HTMLDivElement;
  private pinLayerEl!: HTMLDivElement;
  private markers: MapMarker[] = [];
  private projected = new THREE.Vector3();

  public onTravelToDistrict?: (district: DistrictData) => void;
  public onTravelToLandmark?: (landmark: MapLandmark) => void;
  /** Where the place a pin stands for really is in the city, when the map is the city itself. Null if it has no real counterpart. */
  public locate?: (landmark: MapLandmark) => THREE.Vector3 | null;
  public onTravelToProperty?: (property: MapProperty) => void;
  /** Returns false when the trip could not be paid for. `enterInside` continues through the door on arrival. */
  public onTravelWithTransport?: (dest: DestinationDefinition, transport: TransportOption, enterInside: boolean) => boolean;
  public onPropertyUpdated?: (propertyId: string) => void;
  public onInterstateTravel?: (destCityId: string) => void;
  public onSelectDistrictFromChips?: (districtId: string) => void;
  public onCloseMap?: () => void;
  public onSwitchCityTab?: (cityId: string) => void;
  /** The map has been put away, however that was done */
  public onClosed?: () => void;
  /** The city the player is standing in, and the city whose map is up */
  public standing?: () => { here: string; viewing: string };
  /** How far it is on foot to a place in the city the player is in. Asking also draws the way on the map. */
  public wayTo?: (landmark: MapLandmark) => { metres: number } | null;
  /** The card of a place has been put away: so is the way that was drawn to it */
  public onCardClosed?: () => void;
  /** Bring a place to the middle of the map */
  public onFocus?: (landmark: MapLandmark) => void;
  public onOpenEconomy?: (propertyId: string) => void;
  public onEnterInterior?: (buildingId: string) => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'world-map-ui-root';
    this.container.className = 'world-map-ui-layer';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <!-- PLACE PINS & AREA NAMES (drawn over the 3D map, kept in step with the map camera) -->
      <div class="map-pin-layer show-names" id="map-pin-layer"></div>

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
          <div class="map-search" id="map-search">
            <span>🔎</span>
            <input id="map-search-input" type="search" placeholder="Find a place: bank, food, stadium" autocomplete="off" spellcheck="false" />
            <div class="map-search-results" id="map-search-results" style="display: none;"></div>
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
        <span class="city-tab-divider"></span>
        <button class="map-names-toggle active" id="btn-map-names" title="Show or hide place names">🏷️ Names</button>
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
        <span>🖱️ Drag to pan • Scroll to zoom • Tap a pin to see what is there and how to get to it</span>
      </div>
    `;

    document.body.appendChild(this.container);

    this.cardEl = document.getElementById('map-context-card') as HTMLDivElement;
    this.districtChipsEl = document.getElementById('map-district-chips') as HTMLDivElement;
    this.pinLayerEl = document.getElementById('map-pin-layer') as HTMLDivElement;

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
      this.onCardClosed?.();
    });

    // Finding a place by name, or by what is done there
    const search = document.getElementById('map-search-input') as HTMLInputElement | null;
    search?.addEventListener('input', () => this.showSearchResults(search.value));
    search?.addEventListener('focus', () => this.showSearchResults(search.value));
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (document.querySelector('#map-search-results .map-search-hit') as HTMLElement | null)?.click();
      if (e.key === 'Escape') {
        search.value = '';
        this.showSearchResults('');
        search.blur();
      }
    });

    document.getElementById('btn-map-names')?.addEventListener('click', (e) => {
      const showing = this.pinLayerEl.classList.toggle('show-names');
      (e.currentTarget as HTMLElement).classList.toggle('active', showing);
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

  /**
   * Places that answer to what was typed: by name first, then by what kind of place it is and
   * what is done there. Those in the city on show come first, then those in the other cities.
   */
  public findPlaces(text: string): Array<{ id: string; name: string; icon: string; where: string; city: string; here: boolean }> {
    const wanted = text.trim().toLowerCase();
    if (wanted.length < 2) return [];
    const registry = DestinationRegistry.getInstance();
    const viewing = this.standing?.().viewing ?? 'lagos';
    const rank = (name: string, more: string[]): number => {
      const lower = name.toLowerCase();
      if (lower.startsWith(wanted)) return 0;
      if (lower.split(/[^a-z0-9]+/).some((word) => word.startsWith(wanted))) return 1;
      if (lower.includes(wanted)) return 2;
      if (more.some((term) => term.toLowerCase().includes(wanted))) return 3;
      return -1;
    };
    const hits: Array<{ id: string; name: string; icon: string; where: string; city: string; here: boolean; rank: number }> = [];
    const data = WorldDataManager.getInstance();
    for (const city of [viewing, ...Object.keys(CITY_LABEL).filter((one) => one !== viewing)]) {
      const here = city === viewing;
      for (const lm of data.landmarksOf(city)) {
        const dest = registry.getById(lm.id);
        const score = rank(dest?.name ?? lm.name, [lm.type, lm.subtitle, dest?.category ?? '', ...(dest?.services ?? [])]);
        if (score < 0) continue;
        const where = here ? dest?.districtName ?? data.getDistrictById(lm.districtId)?.name ?? '' : `In ${CITY_LABEL[city]}`;
        hits.push({ id: lm.id, name: dest?.name ?? lm.name, icon: lm.icon || dest?.mapIcon || '📍', where, city, here, rank: score + (here ? 0 : 10) });
      }
    }
    return hits.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, 8);
  }

  private showSearchResults(text: string): void {
    const list = document.getElementById('map-search-results');
    if (!list) return;
    const hits = this.findPlaces(text);
    list.innerHTML = '';
    if (text.trim().length < 2) {
      list.style.display = 'none';
      return;
    }
    list.style.display = 'block';
    if (hits.length === 0) {
      const none = document.createElement('div');
      none.className = 'map-search-none';
      none.textContent = `Nothing called "${text.trim()}" on the map.`;
      list.appendChild(none);
      return;
    }
    for (const hit of hits) {
      const row = document.createElement('button');
      row.className = 'map-search-hit';
      row.dataset.place = hit.id;
      const icon = document.createElement('span');
      icon.className = 'hit-icon';
      icon.textContent = hit.icon;
      const name = document.createElement('span');
      name.className = 'hit-name';
      name.textContent = hit.name;
      const where = document.createElement('span');
      where.className = 'hit-where';
      where.textContent = hit.where;
      row.append(icon, name, where);
      row.addEventListener('click', () => {
        list.style.display = 'none';
        this.goToPlace(hit.id, hit.city);
      });
      list.appendChild(row);
    }
  }

  /** Brings a place up on the map: its city's map if another one is on show, the place in the middle, its card open. */
  public goToPlace(placeId: string, city: string): boolean {
    if ((this.standing?.().viewing ?? city) !== city) this.onSwitchCityTab?.(city);
    const registry = DestinationRegistry.getInstance();
    const wanted = registry.getById(placeId);
    const lm = WorldDataManager.getInstance().getLandmarks().find((one) => one.id === placeId || (wanted !== null && registry.getById(one.id)?.id === wanted.id));
    if (!lm) return false;
    this.onFocus?.(lm);
    this.showLandmarkDetails(lm);
    return true;
  }

  /** Shows which city's map is up, and which city the player is actually standing in. */
  public markCityTabs(viewing: string, playerCity: string): void {
    const names: Record<string, string> = { lagos: '🏖️ Lagos', abuja: '⛰️ Abuja FCT', port_harcourt: '🛢️ Port Harcourt' };
    this.container.querySelectorAll('.city-nav-tab').forEach((tab) => {
      const city = tab.getAttribute('data-city') ?? '';
      tab.classList.toggle('active', city === viewing);
      tab.textContent = `${names[city] ?? city}${city === playerCity ? ' (you are here)' : ''}`;
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
    this.rebuildPins();
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

  /**
   * Builds a pin for every place and a name for every district of the city on show.
   * They are ordinary page elements, so the text stays sharp at any zoom.
   */
  public rebuildPins(): void {
    this.pinLayerEl.innerHTML = '';
    this.markers = [];
    const data = WorldDataManager.getInstance();

    for (const d of data.getDistricts()) {
      const label = document.createElement('div');
      label.className = 'map-area-name';
      label.textContent = d.name;
      this.pinLayerEl.appendChild(label);
      this.markers.push({ el: label, position: new THREE.Vector3(d.center.x, 0.6, d.center.z) });
    }

    for (const lm of data.getLandmarks()) {
      const pin = document.createElement('button');
      pin.className = 'map-pin';
      pin.dataset.place = lm.id;
      pin.title = lm.name;

      const icon = document.createElement('span');
      icon.className = 'map-pin-icon';
      icon.textContent = lm.icon || '📍';
      const name = document.createElement('span');
      name.className = 'map-pin-name';
      name.textContent = shortPlaceName(lm.name);
      pin.append(icon, name);

      pin.addEventListener('click', () => this.showLandmarkDetails(lm));
      this.pinLayerEl.appendChild(pin);
      // Sits just above the roof of the little building it marks
      // Over the real place when there is one; otherwise where the map's own drawing has it
      const real = this.locate?.(lm) ?? null;
      const at = real ?? lm.position;
      this.markers.push({ el: pin, position: new THREE.Vector3(at.x, 9, at.z), place: lm.id, real: real !== null });
    }
  }

  /** Every place pinned on the map now, where its pin is, and whether that is a real place in the city. */
  public pinPlaces(): Array<{ id: string; x: number; z: number; real: boolean }> {
    return this.markers.filter((marker) => marker.place).map((marker) => ({ id: marker.place!, x: marker.position.x, z: marker.position.z, real: !!marker.real }));
  }

  /** Moves every pin to where its place currently appears on screen. Call once a frame while the map is open. */
  public updatePins(camera: THREE.Camera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const marker of this.markers) {
      this.projected.copy(marker.position).project(camera);
      const x = (this.projected.x + 1) * 0.5 * w;
      const y = (1 - this.projected.y) * 0.5 * h;
      const visible = this.projected.z < 1 && x > -80 && x < w + 80 && y > -40 && y < h + 40;
      marker.el.style.display = visible ? '' : 'none';
      if (visible) {
        marker.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }
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

    const stats = document.getElementById('map-card-stats');
    if (stats) stats.style.display = '';

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
    const actions = document.getElementById('map-card-actions');

    // The three-number grid is for districts and properties; a place shows what you can do there instead
    const stats = document.getElementById('map-card-stats');
    if (stats) stats.style.display = 'none';

    const canonicalDest = DestinationRegistry.getInstance().getById(lm.id);

    // A place in another city is looked at, not gone to: getting there is a flight or a coach
    const standing = this.standing?.();
    const elsewhere = !!standing && standing.here !== standing.viewing;
    const way = elsewhere ? null : this.wayTo?.(lm) ?? null;
    const onFoot = way ? `${Math.round(way.metres).toLocaleString()} m on foot by the streets, about ${walkingTime(way.metres)}` : '';
    const elsewhereHtml = elsewhere
      ? `
          <div class="sheet-label">How to get there</div>
          <p class="sheet-note" id="map-card-elsewhere">This is in ${CITY_LABEL[standing!.viewing] ?? standing!.viewing}. You are in ${CITY_LABEL[standing!.here] ?? standing!.here}: you go there by air or by coach.</p>
          <button class="sheet-go-btn" id="btn-card-interstate">Flights and coaches to ${CITY_LABEL[standing!.viewing] ?? standing!.viewing}</button>
        `
      : '';
    const wireElsewhere = () => {
      document.getElementById('btn-card-interstate')?.addEventListener('click', () => this.onInterstateTravel?.(standing!.viewing));
    };

    if (canonicalDest && elsewhere) {
      if (chip) chip.textContent = `${canonicalDest.mapIcon} ${canonicalDest.category.toUpperCase()}`;
      if (zone) zone.textContent = canonicalDest.districtName;
      if (name) name.textContent = canonicalDest.name;
      if (sub) sub.textContent = canonicalDest.openingHours;
      if (desc) desc.textContent = canonicalDest.destinationDescription;
      if (actions) {
        actions.innerHTML = `
          <div class="sheet-label">What you can do here</div>
          <div class="sheet-chips">
            ${canonicalDest.services.map((s) => `<span class="sheet-chip">${s}</span>`).join('')}
          </div>
          ${elsewhereHtml}
        `;
        wireElsewhere();
      }
    } else if (canonicalDest) {
      if (chip) chip.textContent = `${canonicalDest.mapIcon} ${canonicalDest.category.toUpperCase()}`;
      if (zone) zone.textContent = canonicalDest.districtName;
      if (name) name.textContent = canonicalDest.name;
      if (sub) sub.textContent = `🟢 ${canonicalDest.openingHours}`;
      if (desc) desc.textContent = canonicalDest.destinationDescription;

      if (actions) {
        // Your own car is something you get into and drive: it is not a ride that can be called
        const options = canonicalDest.transportAvailability.filter((t) => t.mode !== 'car');
        actions.innerHTML = `
          <div class="sheet-label">What you can do here</div>
          <div class="sheet-chips">
            ${canonicalDest.services.map((s) => `<span class="sheet-chip">${s}</span>`).join('')}
          </div>

          <div class="sheet-label">How will you get there?</div>
          <div class="transport-grid">
            ${options
              .map(
                (t) => `
              <button class="transport-tile" data-mode="${t.mode}" title="${t.description}">
                <span class="transport-icon">${t.icon}</span>
                <span class="transport-name">${t.label}</span>
                <span class="transport-fare${t.fare === 0 ? ' free' : ''}">${t.fare === 0 ? 'Free' : '₦' + t.fare.toLocaleString()}</span>
              </button>
            `
              )
              .join('')}
          </div>
          ${onFoot ? `<p class="sheet-note" id="map-card-way">🚶 ${onFoot}</p>` : ''}

          <button class="sheet-go-btn" id="btn-card-go"></button>
          <button class="sheet-link-btn" id="btn-card-walk-exterior">Stop outside instead of going in</button>
        `;

        const tiles = Array.from(actions.querySelectorAll<HTMLElement>('.transport-tile'));
        const goBtn = document.getElementById('btn-card-go') as HTMLButtonElement;
        let chosen = options[0];

        const choose = (t: TransportOption) => {
          chosen = t;
          tiles.forEach((tile) => tile.classList.toggle('selected', tile.dataset.mode === t.mode));
          goBtn.textContent = t.fare === 0 ? `Go by ${t.label} · Free` : `Go by ${t.label} · ₦${t.fare.toLocaleString()}`;
        };
        tiles.forEach((tile) => {
          tile.addEventListener('click', () => {
            const picked = options.find((o) => o.mode === tile.dataset.mode);
            if (picked) choose(picked);
          });
        });
        choose(chosen);

        // The trip handler closes the map itself once the fare is paid, so a failed payment leaves the sheet open
        goBtn.addEventListener('click', () => this.onTravelWithTransport?.(canonicalDest, chosen, true));
        document.getElementById('btn-card-walk-exterior')?.addEventListener('click', () => {
          this.onTravelWithTransport?.(canonicalDest, chosen, false);
        });
      }
    } else {
      // Places without an interior of their own: travel to the spot on the street
      const district = WorldDataManager.getInstance().getDistrictById(lm.districtId);

      if (chip) chip.textContent = lm.icon + ' LANDMARK';
      if (zone) zone.textContent = district ? district.name : lm.type.toUpperCase();
      if (name) name.textContent = lm.name || lm.title;
      if (sub) sub.textContent = lm.subtitle;
      if (desc) desc.textContent = lm.description;

      if (actions && elsewhere) {
        actions.innerHTML = elsewhereHtml;
        wireElsewhere();
      } else if (actions) {
        actions.innerHTML = `
          ${onFoot ? `<p class="sheet-note" id="map-card-way">🚶 ${onFoot}</p>` : ''}
          <button class="sheet-go-btn" id="btn-card-go">Walk there · Free</button>
        `;
        document.getElementById('btn-card-go')?.addEventListener('click', () => this.onTravelToLandmark?.(lm));
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

    const stats = document.getElementById('map-card-stats');
    if (stats) stats.style.display = '';

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
    this.rebuildPins();
    UIStateManager.getInstance().setMode('world-map');
  }

  public close(): void {
    this.container.style.display = 'none';
    this.cardEl.style.display = 'none';
    this.onCardClosed?.();
    const results = document.getElementById('map-search-results');
    if (results) results.style.display = 'none';
    const search = document.getElementById('map-search-input') as HTMLInputElement | null;
    if (search) search.value = '';
    const tt = document.getElementById('map-hover-tooltip');
    if (tt) tt.style.display = 'none';
    if (UIStateManager.getInstance().isMode('world-map')) {
      UIStateManager.getInstance().setMode('street');
    }
    this.onClosed?.();
  }
}
