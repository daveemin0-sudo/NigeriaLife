import type { InteractiveObject, InteractionTarget, World } from '../world/World';
import { Player } from '../player/Player';
import type { CityId } from '../cities/CityTypes';
import { CharacterCreatorModal } from './CharacterCreator';
import { InventoryModal } from './InventoryModal';
import { ATMModal } from './ATMModal';
import { PhoneModal } from './PhoneModal';
import { EconomyModal } from './EconomyModal';
import { TravelModal } from './TravelModal';
import { InterStateModal } from './InterStateModal';
import { WorldMapUI } from './WorldMapUI';
import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import { WorldDataManager } from '../world/data/WorldDataManager';
import type { MapBusiness } from '../world/data/WorldDataTypes';

export class HUD {
  private container: HTMLDivElement;
  private interactionCard: HTMLDivElement;
  private drivingHudEl!: HTMLDivElement;
  public proximityPromptEl: HTMLDivElement | null = null;
  public promptLabelEl: HTMLSpanElement | null = null;
  public currentInteractionTarget: InteractionTarget | null = null;
  private creatorModal!: CharacterCreatorModal;
  private inventoryModal!: InventoryModal;
  private atmModal!: ATMModal;
  public phoneModal!: PhoneModal;
  public economyModal!: EconomyModal;
  public travelModal!: TravelModal;
  public interstateModal!: InterStateModal;
  public worldMapUI!: WorldMapUI;
  private player!: Player;
  private world?: World;
  private backend: BackendService;
  public currentActiveObject: InteractiveObject | null = null;

  public onExitVehicle?: () => void;
  public onHonkVehicle?: () => void;
  public onEnterVehicle?: (vehicleId: string) => void;
  public onEnterInterior?: (buildingId: string) => void;
  public onExitInterior?: () => void;
  public onNavigateMode?: (mode: 'street' | 'home' | 'map') => void;
  public onRadarNavigate?: (destId: string) => void;
  public onRotateCamera?: (deltaYaw: number) => void;
  public onResetCamera?: () => void;
  public onCycleCameraPreset?: () => string;
  public currentNavMode: 'street' | 'home' | 'map' = 'street';

  constructor() {
    this.backend = BackendService.getInstance();
    this.inventoryModal = new InventoryModal();
    this.atmModal = new ATMModal();
    this.inventoryModal.onOpenATM = () => this.atmModal.open();
    this.phoneModal = new PhoneModal();
    this.economyModal = new EconomyModal();
    this.travelModal = new TravelModal();
    this.interstateModal = new InterStateModal();
    this.worldMapUI = new WorldMapUI();

    this.container = document.createElement('div');
    this.container.id = 'hud-overlay';
    this.container.innerHTML = `
      <!-- Top Status Header (Viral Lagos Life Replica) -->
      <header class="hud-header">
        <!-- Top Left Badges (Match, Music, Gem Hunt) -->
        <div class="hud-top-left-badges">
          <div class="top-badge quest-badge" id="badge-super-eagles" title="Tap to celebrate & dance!">
            <span class="badge-icon">⚽</span>
            <div class="badge-text">
              <span class="badge-title">Super Eagles Match</span>
              <span class="badge-sub">Tap to cheer & dance</span>
            </div>
          </div>
          <div class="top-badge music-badge" id="badge-afrobeats" title="Play Afrobeats Radio">
            <span class="badge-icon">🎶</span>
            <div class="badge-text">
              <span class="badge-title">Play some music</span>
              <span class="badge-sub">+2 Mood Boost</span>
            </div>
          </div>
          <div class="top-badge gem-badge" id="badge-gem-hunt" title="Daily Naira Gem Quest">
            <span class="badge-icon">💎</span>
            <div class="badge-text">
              <span class="badge-title">Daily gem hunt</span>
              <span class="badge-sub">87,691 found • Next: ₦3,000</span>
            </div>
          </div>
        </div>

        <!-- Center Floating Pill Bar -->
        <div class="hud-center-pill-bar">
          <div class="pill-item time-pill" id="hud-time-pill" title="Click to cycle Time of Day (Midday / Sunset / Night / Morning)" style="cursor: pointer;">
            <span id="hud-weather-icon">☀️</span>
            <span id="hud-clock-val">Wed 7 • 1:18 PM</span>
          </div>
          <div class="pill-item mood-pill" id="pill-mood" title="Current Character Mood">
            <span id="hud-mood-icon">😄</span>
            <span id="hud-mood-val">Very Happy</span>
          </div>
          <div class="pill-item online-pill">
            <span>👥</span>
            <span>17.6m • <strong style="color: #4ade80;">🟢 85k online</strong></span>
          </div>
          <button class="sound-toggle-btn" id="hud-sound-toggle" title="Toggle Afrobeats Radio">🔊</button>
          <div class="pill-item money-pill-large" id="pill-money-wrap">
            <span id="hud-money">₦25,000</span>
            <button class="btn-quick-deposit" id="btn-quick-topup" title="Withdraw / Deposit at Bank ATM">+</button>
          </div>
        </div>

        <!-- Top Right Mini District Indicator & Camera View Switcher -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn-camera-view-toggle" id="btn-camera-view-toggle" title="Switch Camera View [V] (Third-Person / Street / Isometric / Aerial)">
            <span>🎥</span>
            <span id="cam-preset-label">STREET</span>
          </button>
          <div class="hud-location">
            <span class="flag">🇳🇬</span>
            <div class="loc-details">
              <span class="loc-name" id="hud-loc-name">Lagos Island</span>
              <span class="loc-sub" id="hud-loc-sub">Broad Street</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Street Distance Radar (Appears during Street Walk) -->
      <div class="street-radar-bar" id="street-radar-bar">
        <div class="radar-header-pill">
          <span>📍</span>
          <span id="radar-loc-title">Herbert Macaulay Way • Tejuosho Junction</span>
        </div>
        <div class="radar-pills-row">
          <button class="radar-pill" data-dest="dest_cchub">💡 CcHub - 410m</button>
          <button class="radar-pill" data-dest="dest_quilox">🍾 Quilox VIP - 350m</button>
          <button class="radar-pill" data-dest="dest_amala">🍲 Amala Shitta - 220m</button>
          <button class="radar-pill" data-dest="dest_lekki">🌉 Lekki Bridge - 850m</button>
          <button class="radar-pill" data-dest="dest_ikeja">🔌 Computer Village - 600m</button>
        </div>
      </div>

      <!-- Aerial Map City Switcher Bar (Appears when Map is active) -->
      <div class="map-city-switcher" id="map-city-switcher" style="display: none;">
        <div class="city-switch-tabs">
          <button class="city-tab active" data-city="lagos">🏖️ Lagos</button>
          <button class="city-tab" data-city="abuja">⛰️ Abuja</button>
          <button class="city-tab" data-city="port_harcourt">🛢️ Port Harcourt</button>
        </div>
        <div class="map-filter-pills">
          <button class="map-filter-btn active" id="btn-walk-street">🚶 Walk Street</button>
          <button class="map-filter-btn" id="btn-open-interstate">✈️ Book Flights [M]</button>
        </div>
      </div>

      <!-- Bottom Master Navigation Bar (Home | Buy | Map | Phone) -->
      <div class="bottom-master-nav">
        <button class="master-nav-item" id="nav-btn-home" title="Apartment Flat Interior">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </button>
        <button class="master-nav-item" id="nav-btn-buy" title="Real Estate, Cars & Businesses">
          <span class="nav-icon">🛍️</span>
          <span class="nav-label">Buy</span>
        </button>
        <button class="master-nav-item" id="nav-btn-map" title="Aerial City World Map">
          <span class="nav-icon">🗺️</span>
          <span class="nav-label">Map</span>
        </button>
        <button class="master-nav-item" id="nav-btn-phone" title="Smartphone OS [Key P]">
          <span class="nav-icon">📱</span>
          <span class="nav-label">Phone</span>
          <span class="nav-badge">8</span>
        </button>
      </div>

      <!-- Bottom Guidance & Quick Emote Bar -->
      <footer class="hud-footer">
        <div class="emote-bar">
          <span class="emote-bar-title">Moves:</span>
          <button class="emote-btn" id="emote-zanku" title="Shortcut: Key 1">
            <span>🕺</span>
            <span>Zanku [1]</span>
          </button>
          <button class="emote-btn" id="emote-groove" title="Shortcut: Key 2">
            <span>🎶</span>
            <span>Afrobeats [2]</span>
          </button>
          <button class="emote-btn" id="emote-salute" title="Shortcut: Key 3">
            <span>🫡</span>
            <span>Salute [3]</span>
          </button>
        </div>

        <div class="hud-hint">
          <span class="mouse-icon">🖱️</span>
          <span>Click to walk • Right-click drag or [Q]/[R] to rotate view • [E] Interact</span>
        </div>
      </footer>

      <!-- Floating Camera Orbit Controls (360° View) -->
      <div class="camera-rotate-widget" id="camera-rotate-widget">
        <button class="cam-rot-btn" id="btn-cam-left" title="Rotate View Left [Q] or Right-Click Drag">
          <span>↺</span>
          <span class="cam-btn-lbl">Q</span>
        </button>
        <button class="cam-rot-btn cam-center" id="btn-cam-reset" title="Reset Camera View [⊙]">
          <span>⊙</span>
        </button>
        <button class="cam-rot-btn" id="btn-cam-right" title="Rotate View Right [R] or Right-Click Drag">
          <span class="cam-btn-lbl">R</span>
          <span>↻</span>
        </button>
      </div>

      <!-- Interaction Modal / Card -->
      <div class="interaction-card" id="interaction-card" style="display: none;">
        <button class="card-close" id="card-close">&times;</button>
        <span class="card-tag" id="card-category">Food & Health</span>
        <h2 class="card-title" id="card-title">Mama Put Buka</h2>
        <p class="card-desc" id="card-desc">Hot Jollof rice, plantain, and pepper soup.</p>
        <div id="card-biz-meta" style="display: none; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #94a3b8;">Status: <strong id="card-biz-status" style="color: #4ade80;">OPEN</strong></span>
            <span style="color: #94a3b8;">Owner: <strong id="card-biz-owner" style="color: #f8fafc;">NPC</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Daily Revenue: <strong id="card-biz-revenue" style="color: #fbbf24;">₦45,000</strong></span>
            <span style="color: #38bdf8; font-weight: 500;">Commercial Hub</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-primary" id="card-action-btn">Enter / Order</button>
          <button class="btn-secondary" id="card-biz-btn" style="display: none;">💼 View Business [E]</button>
        </div>
      </div>

      <!-- Driving HUD Widget (Speedometer & Controls) -->
      <div class="driving-hud-panel" id="driving-hud" style="display: none;">
        <div class="speedo-box">
          <span class="speedo-val" id="speedo-val">0</span>
          <span class="speedo-unit">KM/H</span>
        </div>
        <div class="driving-meta-box">
          <h4 id="driving-veh-name">Danfo Minibus</h4>
          <span class="driving-hint">WASD / Arrows to Drive • SPACE Handbrake</span>
        </div>
        <div class="driving-actions-bar">
          <button class="btn-hud-horn" id="btn-drive-horn" title="Honk Horn [Key H]">📢 Honk [H]</button>
          <button class="btn-hud-exit-veh" id="btn-drive-exit" title="Exit Vehicle [Key F]">🚪 Exit [F]</button>
        </div>
      </div>

      <!-- Contextual Interaction Proximity Prompt Pill -->
      <div class="hud-proximity-prompt" id="hud-proximity-prompt" style="display: none;">
        <span class="prompt-key-badge">E</span>
        <span class="prompt-label" id="hud-prompt-label">Enter Hospital</span>
      </div>
    `;

    document.body.appendChild(this.container);

    this.interactionCard = document.getElementById('interaction-card') as HTMLDivElement;
    this.drivingHudEl = document.getElementById('driving-hud') as HTMLDivElement;
    this.proximityPromptEl = document.getElementById('hud-proximity-prompt') as HTMLDivElement;
    this.promptLabelEl = document.getElementById('hud-prompt-label') as HTMLSpanElement;

    this.proximityPromptEl?.addEventListener('click', () => {
      this.executeCurrentInteraction();
    });

    const closeBtn = document.getElementById('card-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hideInteractionCard());

    const actionBtn = document.getElementById('card-action-btn') as HTMLButtonElement;
    actionBtn.addEventListener('click', () => this.handleCardAction());

    const bizBtn = document.getElementById('card-biz-btn') as HTMLButtonElement;
    bizBtn.addEventListener('click', () => {
      if (this.currentActiveObject) {
        this.economyModal.open(this.currentActiveObject.id);
        this.hideInteractionCard();
      }
    });

    // Subscribe to live backend updates
    this.backend.subscribe(this.onDataUpdate.bind(this));
  }

  private onDataUpdate(data: PlayerAccount): void {
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) {
      moneyEl.textContent = `₦${data.walletCash.toLocaleString()}`;
    }

    const energyEl = document.getElementById('hud-energy');
    if (energyEl) {
      energyEl.textContent = `${data.stats.energy}% Energy`;
    }
  }

  public init(player: Player, world?: World): void {
    this.player = player;
    this.world = world;
    this.creatorModal = new CharacterCreatorModal(player);

    document.getElementById('open-wardrobe-btn')?.addEventListener('click', () => {
      this.creatorModal.toggle();
    });

    document.getElementById('open-inventory-btn')?.addEventListener('click', () => {
      this.inventoryModal.toggle();
    });

    document.getElementById('open-atm-btn')?.addEventListener('click', () => {
      this.atmModal.open();
    });

    document.getElementById('open-phone-btn')?.addEventListener('click', () => {
      this.phoneModal.toggle();
    });

    document.getElementById('open-econ-btn')?.addEventListener('click', () => {
      this.economyModal.toggle();
    });

    document.getElementById('open-travel-btn')?.addEventListener('click', () => {
      this.travelModal.toggle();
    });

    document.getElementById('open-interstate-btn')?.addEventListener('click', () => {
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
    });

    document.getElementById('hud-weather-btn')?.addEventListener('click', () => {
      if (this.world) {
        const newW = this.world.weather.toggleWeather();
        this.updateWeatherButton(newW);
      }
    });

    document.getElementById('btn-drive-exit')?.addEventListener('click', () => {
      this.onExitVehicle?.();
    });

    document.getElementById('btn-drive-horn')?.addEventListener('click', () => {
      this.onHonkVehicle?.();
    });

    // Emote buttons
    document.getElementById('emote-zanku')?.addEventListener('click', () => {
      this.player.playEmote('zanku', 4.0);
    });

    document.getElementById('emote-groove')?.addEventListener('click', () => {
      this.player.playEmote('groove', 4.0);
    });

    document.getElementById('emote-salute')?.addEventListener('click', () => {
      this.player.playEmote('salute', 3.0);
    });

    // Camera Orbit & View Controls
    document.getElementById('btn-cam-left')?.addEventListener('click', () => {
      this.onRotateCamera?.(Math.PI / 4);
    });

    document.getElementById('btn-cam-right')?.addEventListener('click', () => {
      this.onRotateCamera?.(-Math.PI / 4);
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', () => {
      this.onResetCamera?.();
    });

    document.getElementById('btn-camera-view-toggle')?.addEventListener('click', () => {
      if (this.onCycleCameraPreset) {
        const next = this.onCycleCameraPreset();
        const names: Record<string, string> = {
          close: '3RD PERSON',
          street: 'STREET',
          isometric: 'ISOMETRIC',
          aerial: 'AERIAL',
        };
        const lbl = document.getElementById('cam-preset-label');
        if (lbl) lbl.textContent = names[next] || next.toUpperCase();
        this.showNotification(`📷 Camera View: ${names[next] || next}`);
      }
    });

    // Bottom Master Navigation Bar (Home, Buy, Map, Phone)
    const navHomeBtn = document.getElementById('nav-btn-home');
    const navBuyBtn = document.getElementById('nav-btn-buy');
    const navMapBtn = document.getElementById('nav-btn-map');
    const navPhoneBtn = document.getElementById('nav-btn-phone');

    const updateNavActive = (activeId: string) => {
      [navHomeBtn, navBuyBtn, navMapBtn, navPhoneBtn].forEach((btn) => btn?.classList.remove('active'));
      if (activeId) document.getElementById(activeId)?.classList.add('active');
    };

    navHomeBtn?.addEventListener('click', () => {
      this.currentNavMode = 'home';
      updateNavActive('nav-btn-home');
      this.worldMapUI.close();
      const switcher = document.getElementById('map-city-switcher');
      if (switcher) switcher.style.display = 'none';
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'none';
      this.onNavigateMode?.('home');
    });

    navBuyBtn?.addEventListener('click', () => {
      this.economyModal.toggle();
    });

    navMapBtn?.addEventListener('click', () => {
      this.currentNavMode = 'map';
      updateNavActive('nav-btn-map');
      const switcher = document.getElementById('map-city-switcher');
      if (switcher) switcher.style.display = 'none';
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'none';
      this.worldMapUI.open();
      this.onNavigateMode?.('map');
    });

    navPhoneBtn?.addEventListener('click', () => {
      this.phoneModal.toggle();
    });

    document.getElementById('btn-walk-street')?.addEventListener('click', () => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      const switcher = document.getElementById('map-city-switcher');
      if (switcher) switcher.style.display = 'none';
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      this.onNavigateMode?.('street');
    });

    // Wire WorldMapUI event handlers
    this.worldMapUI.onCloseMap = () => {
      this.currentNavMode = 'street';
      updateNavActive('');
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onTravelToDistrict = (district) => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      this.player.mesh.position.copy(district.streetSpawnPoint);
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onInterstateTravel = (destCityId) => {
      this.interstateModal.open((destCityId as any) || this.world?.cityManager.currentCityId);
    };

    this.worldMapUI.onSelectDistrictFromChips = (districtId) => {
      this.world?.worldMap.focusOnDistrict(districtId);
    };

    this.worldMapUI.onSwitchCityTab = (cityId) => {
      if (this.world) {
        this.world.cityManager.switchCity(cityId as any, this.player, (newObjs) => {
          if (this.world) this.world.interactiveObjects = newObjs;
        });
      }
    };

    this.worldMapUI.onTravelToProperty = (prop) => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      this.player.mesh.position.set(prop.streetPosition.x, prop.streetPosition.y, prop.streetPosition.z);
      this.world?.highlightStreetProperty(prop.streetPosition, prop.name);
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onPropertyUpdated = () => {
      this.world?.worldMap.renderer.refreshPropertyMarkers();
    };

    this.worldMapUI.onOpenEconomy = (propId) => {
      this.economyModal.open(propId);
    };

    if (this.world) {
      this.world.worldMap.onSelectItem = (event) => {
        if (event.type === 'district') {
          this.worldMapUI.showDistrictDetails(event.item as any);
        } else if (event.type === 'landmark') {
          this.worldMapUI.showLandmarkDetails(event.item as any);
        } else if (event.type === 'property') {
          this.worldMapUI.showPropertyDetails(event.item as any);
        }
      };
    }

    document.getElementById('btn-open-interstate')?.addEventListener('click', () => {
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
    });

    // City tabs inside aerial map view
    document.querySelectorAll('.city-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.city-tab').forEach((t) => t.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const city = target.getAttribute('data-city') as CityId;
        if (city && this.world) {
          this.world.cityManager.switchCity(city, this.player, (newObjs) => {
            if (this.world) this.world.interactiveObjects = newObjs;
          });
        }
      });
    });

    // Top left badges
    document.getElementById('badge-super-eagles')?.addEventListener('click', () => {
      this.player.playEmote('groove', 4.0);
      alert('⚽ 🇳🇬 SUPER EAGLES NAIJA! Goal celebration! Super Eagles 2 - 0 Rivals! The stadium goes wild!');
    });

    document.getElementById('badge-afrobeats')?.addEventListener('click', () => {
      this.player.playEmote('groove', 5.0);
      alert('🎶 Now Playing: Asake - "Amapiano" & Burna Boy - "City Boys" 🎧 Mood boosted!');
    });

    document.getElementById('badge-gem-hunt')?.addEventListener('click', () => {
      const reward = 3000;
      this.backend.addCash(reward);
      this.backend.addStreetCred(10);
      alert(`💎 Daily Naira Gem Hunt completed! Found hidden Lagos Gem! +₦${reward.toLocaleString()} cash credited to your wallet!`);
    });

    // Radar pills navigation
    document.querySelectorAll('.radar-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const dest = target.getAttribute('data-dest');
        if (dest) {
          this.onRadarNavigate?.(dest);
        }
      });
    });

    // Quick ATM topup button
    document.getElementById('btn-quick-topup')?.addEventListener('click', () => {
      this.atmModal.open();
    });

    // Sound toggle button
    document.getElementById('hud-sound-toggle')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      if (btn.textContent === '🔊') {
        btn.textContent = '🔈';
      } else {
        btn.textContent = '🔊';
      }
    });

    // Time-of-day click cycle (Midday -> Golden Hour -> Night -> Morning)
    document.getElementById('hud-time-pill')?.addEventListener('click', () => {
      this.world?.skyEnvironment.cycleTimeOfDay();
    });

    // Camera Orbit Controls Buttons
    document.getElementById('btn-cam-left')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRotateCamera?.(Math.PI / 4); // 45 degrees left
    });

    document.getElementById('btn-cam-right')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRotateCamera?.(-Math.PI / 4); // 45 degrees right
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onResetCamera?.();
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key.toLowerCase() === 'c') {
        this.creatorModal.toggle();
      } else if (e.key.toLowerCase() === 'i') {
        this.inventoryModal.toggle();
      } else if (e.key.toLowerCase() === 'b') {
        this.atmModal.open();
      } else if (e.key.toLowerCase() === 'p') {
        this.phoneModal.toggle();
      } else if (e.key.toLowerCase() === 'e') {
        if (this.currentInteractionTarget) {
          e.preventDefault();
          this.executeCurrentInteraction();
        } else if (this.interactionCard && this.interactionCard.style.display !== 'none' && this.currentActiveObject) {
          e.preventDefault();
          this.handleCardAction();
        } else {
          this.economyModal.toggle();
        }
      } else if (e.key.toLowerCase() === 't') {
        this.travelModal.toggle();
      } else if (e.key.toLowerCase() === 'm') {
        this.interstateModal.toggle(this.world?.cityManager.currentCityId);
      } else if (e.key === '1') {
        this.player.playEmote('zanku', 4.0);
      } else if (e.key === '2') {
        this.player.playEmote('groove', 4.0);
      } else if (e.key === '3') {
        this.player.playEmote('salute', 3.0);
      } else if (e.key === 'Escape') {
        this.hideInteractionCard();
        this.creatorModal.close();
        this.inventoryModal.close();
        this.atmModal.close();
        this.phoneModal.close();
        this.economyModal.close();
        this.travelModal.close();
        this.interstateModal.close();
      }
    });
  }

  public setProximityTarget(target: InteractionTarget | null): void {
    this.currentInteractionTarget = target;
    if (!this.proximityPromptEl || !this.promptLabelEl) return;

    if (!target) {
      this.proximityPromptEl.style.display = 'none';
      return;
    }

    this.promptLabelEl.textContent = target.label;
    this.proximityPromptEl.style.display = 'flex';
  }

  public executeCurrentInteraction(): void {
    if (!this.currentInteractionTarget) return;
    const target = this.currentInteractionTarget;
    console.log(`[Interaction] executing: ${target.id}`);

    if (target.action === 'enter-interior') {
      const interiorId = target.interiorId || target.id;
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onEnterInterior?.(interiorId);
    } else if (target.action === 'exit-interior') {
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onExitInterior?.();
    } else if (target.action === 'enter-vehicle') {
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onEnterVehicle?.(target.id);
    } else {
      this.showInteractionCard(target.interactiveObject);
    }
  }

  public updateLocation(name: string, sub: string): void {
    const nameEl = document.getElementById('hud-loc-name');
    const subEl = document.getElementById('hud-loc-sub');
    if (nameEl && nameEl.textContent !== name) nameEl.textContent = name;
    if (subEl && subEl.textContent !== sub) subEl.textContent = sub;
  }

  public updateWeatherButton(type: 'sunny' | 'rainy'): void {
    const iconEl = document.getElementById('hud-weather-icon');
    const labelEl = document.getElementById('hud-weather-label');
    if (iconEl) iconEl.textContent = type === 'sunny' ? '☀️' : '🌧️';
    if (labelEl) labelEl.textContent = type === 'sunny' ? 'Sunny' : 'Rainy';
  }

  public showInteractionCard(obj: InteractiveObject): void {
    this.currentActiveObject = obj;
    const categoryEl = document.getElementById('card-category')!;
    const titleEl = document.getElementById('card-title')!;
    const descEl = document.getElementById('card-desc')!;
    const btnEl = document.getElementById('card-action-btn')!;
    const bizBtn = document.getElementById('card-biz-btn') as HTMLButtonElement;

    categoryEl.textContent = obj.category;
    titleEl.textContent = obj.name;
    descEl.textContent = obj.description;

    const bizMeta = document.getElementById('card-biz-meta');
    const bizStatus = document.getElementById('card-biz-status');
    const bizOwner = document.getElementById('card-biz-owner');
    const bizRev = document.getElementById('card-biz-revenue');

    const businesses = WorldDataManager.getInstance().getBusinesses();
    const matchedBiz = businesses.find((b: MapBusiness) =>
      b.id === obj.id ||
      (obj.id === 'mama-put' && b.id === 'biz_mama_put') ||
      (obj.id === 'bet-shop' && b.id === 'biz_bet9ja') ||
      (obj.id === 'yaba-cchub' && b.id === 'biz_yaba_cchub') ||
      ((obj.id === 'cv-plaza' || obj.id === 'slot-gadgets') && b.id === 'biz_otigba_gadgets') ||
      (obj.id === 'amala-shitta' && b.id === 'biz_surulere_buka') ||
      ((obj.id === 'vi-lounge' || obj.id === 'quilox-club') && b.id === 'biz_quilox') ||
      (obj.id === 'pharmacy' && b.id === 'biz_lekki_clinic') ||
      (obj.id === 'mechanic' && b.id === 'biz_gods_grace_mechanic') ||
      (obj.id === 'fuel-station' && b.id === 'biz_oando_station') ||
      (obj.id === 'vi-tower' && b.id === 'biz_eko_atlantic_fin')
    );

    if (matchedBiz && bizMeta && bizStatus && bizOwner && bizRev) {
      bizMeta.style.display = 'block';
      bizStatus.textContent = matchedBiz.status.toUpperCase();
      bizOwner.textContent = matchedBiz.ownerId || 'NPC';
      bizRev.textContent = `₦${matchedBiz.income.toLocaleString()}`;
    } else if (bizMeta) {
      bizMeta.style.display = 'none';
    }

    if (obj.id === 'mama-put') {
      btnEl.textContent = '🍲 Enter Buka & Mama Put [E]';
      bizBtn.textContent = '💼 Business Office';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'lagos-bank') {
      btnEl.textContent = '🏦 Enter Bank & Wealth Hub [E]';
      bizBtn.textContent = '🏧 Instant ATM';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'lagos-hospital') {
      btnEl.textContent = '🏥 Enter St. Nicholas General Hospital [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police-station') {
      btnEl.textContent = '👮 Enter Area Command Police Station [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'interior_exit_door') {
      btnEl.textContent = '🚪 Exit to Street [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_reception') {
      btnEl.textContent = '📋 Register & Check Vitals (₦500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_doctor_desk') {
      btnEl.textContent = '🩺 Full Medical Diagnosis & Treatment (₦2,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_ward_bed') {
      btnEl.textContent = '🛏️ Rest on Clinical Ward Bed (Full Recovery)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_pharmacy') {
      btnEl.textContent = '💊 Buy Coartem Malaria Medicine (₦1,800)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_atm_station') {
      btnEl.textContent = '🏧 Withdraw ₦10,000 Cash';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_teller_station') {
      btnEl.textContent = '💱 Foreign Remittance Wire Pickup (+₦25,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_manager_desk') {
      btnEl.textContent = '💼 Apply for Lagos SME Loan (+₦50,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'buka_food_counter') {
      btnEl.textContent = '🍲 Order Firewood Party Jollof (₦1,800)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'buka_table_vip') {
      btnEl.textContent = '🍽️ Sit Down & Chop Life (₦2,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police_front_desk') {
      btnEl.textContent = '📝 File Citizen Incident Report (₦500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police_holding_cell') {
      btnEl.textContent = '⚖️ Pay Citizen Bail Bond (₦5,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-workstation') {
      btnEl.textContent = '💻 Complete Remote Tech Sprint (+₦12,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id.startsWith('interior_npc_')) {
      btnEl.textContent = `💬 Gist & Consult ${obj.name}`;
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bet-shop') {
      btnEl.textContent = '⚽ Place Match Ticket (₦1,000)';
      bizBtn.textContent = '💼 POS & Bet9ja Enterprise Hub [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'villa-compound' || obj.id === 'palm-view-flats') {
      btnEl.textContent = '🏠 Enter Apartment / Residence [E]';
      bizBtn.textContent = '🏡 Victoria Estate Property Office [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id.startsWith('veh-')) {
      btnEl.textContent = '🚗 Board & Drive [F]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'danfo-stop') {
      btnEl.textContent = '🗺️ Lagos Inter-City Danfo Transit [T]';
      bizBtn.textContent = '🚌 Transport Fleet Management [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'vi-tower') {
      btnEl.textContent = '🏢 Enter Corporate Penthouse Reception';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'vi-lounge' || obj.id === 'quilox-club') {
      btnEl.textContent = '🍾 Order Dom Pérignon & VIP Table with Sparklers (₦25,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'amala-shitta') {
      btnEl.textContent = '🍲 Order Hot Amala Dudu + Abula & Goat Meat (₦2,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'nepa-generator') {
      btnEl.textContent = '⚡ Pull Starter Cord & Pour ₦1,200 Fuel ("UP NEPA!")';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'cv-plaza') {
      btnEl.textContent = '🔌 Buy 20,000mAh Power Bank & Cable (₦5,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'lekki-bridge') {
      btnEl.textContent = '🌉 Pay Lekki-Ikoyi Toll & Cross Bridge (₦500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'nike-art-gallery') {
      btnEl.textContent = '🎨 Purchase Handcrafted Adire Art (₦12,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'aso-rock-lookout') {
      btnEl.textContent = '⛰️ Admire Geological Monolith & Presidential Lookout';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-mosque') {
      btnEl.textContent = '🕌 Tour National Mosque Architecture';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-christian-centre') {
      btnEl.textContent = '⛪ Visit National Christian Centre Sanctuary';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-secretariat') {
      btnEl.textContent = '📜 Federal Government Procurement & Contracts';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-cab') {
      btnEl.textContent = '🚕 Board Federal Green Cab to Maitama (₦800)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-interstate-hub') {
      btnEl.textContent = '✈️ Book Flight / Luxury Coach to Lagos [M]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-tv') {
      btnEl.textContent = '📺 Watch Super Eagles AFCON Match (Live Broadcast)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-bed') {
      btnEl.textContent = '🛏️ Sleep on Luxury Bed (100% Full Energy Recharge)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-drum') {
      btnEl.textContent = '🪣 Fetch Chilled Water & Bath with Red Bowl (Hygiene +100%)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-sofa') {
      btnEl.textContent = '🛋️ Relax on Living Room Sofa (Energy +30%)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-pet') {
      btnEl.textContent = '🐕 Pet Bingo & Feed Biscuit (Mood Boost +40%)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-hawker') {
      btnEl.textContent = '🥤 Buy Pure Water & Gala (₦200)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-conductor') {
      btnEl.textContent = '🚌 Board Danfo Shuttle (₦300)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-punter') {
      btnEl.textContent = '💬 Gist with Segun (Bet9ja)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'pharmacy') {
      btnEl.textContent = '💊 Buy Medicine & First Aid (₦1,500)';
      bizBtn.textContent = '💼 Pharmacy Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'supermarket') {
      btnEl.textContent = '🛒 Buy Indomie Carton & Peak Milk (₦4,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'slot-gadgets') {
      btnEl.textContent = '📱 Buy 20,000mAh Power Bank & Charger (₦8,500)';
      bizBtn.textContent = '💼 Slot Tech Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'barber-shop') {
      btnEl.textContent = '💈 Executive Fade & Beard Grooming (₦2,500)';
      bizBtn.textContent = '💼 Barbershop Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'fuel-station') {
      btnEl.textContent = '⛽ Buy 10L Petrol Keg & Cold Drink (₦8,500)';
      bizBtn.textContent = '💼 Oando Forecourt Franchise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'mechanic') {
      btnEl.textContent = '🔧 Tune Up Engine & Vehicle Overhaul (₦6,000)';
      bizBtn.textContent = "💼 God's Grace Workshop [E]";
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'construction-site') {
      btnEl.textContent = '👷 Work Construction Day Shift (+₦6,500 Cash)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'palm-view-flats') {
      btnEl.textContent = '🏢 Inspect 2-Bedroom Apartment Flat';
      bizBtn.textContent = '🏡 Palm View Property Office [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'npc-suya') {
      btnEl.textContent = '🥩 Buy Hot Spicy Beef Suya & Onions (₦1,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-emeka') {
      btnEl.textContent = '📱 Screen & Battery Phone Diagnostic (₦3,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-mechanic') {
      btnEl.textContent = '🛠️ Work Mechanic Apprentice Shift (+₦4,000 Gig)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-warden') {
      btnEl.textContent = '👮 Ask for Lagos Traffic & Safety Directions';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-chief') {
      btnEl.textContent = '👑 Greet Elder with Respect ("E nle o, Kabiyesi!")';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-aunty') {
      btnEl.textContent = '👗 Buy Premium Hollandais Wax Fabric (₦18,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-banker') {
      btnEl.textContent = '📈 Invest in 90-Day Federal Treasury Bills (₦50,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'yaba-cchub') {
      btnEl.textContent = '💻 Join Tech Hackathon & Remote Sprint (+₦15,000)';
      bizBtn.textContent = '🚀 Co-Creation Tech Incubator [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'surulere-stadium') {
      btnEl.textContent = '🏃 Athletic Track Workout & Football Training (₦1,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'mma-airport') {
      btnEl.textContent = '✈️ Book Interstate Flight to Abuja / Port Harcourt [M]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'ajah-estate') {
      btnEl.textContent = '👷 Work Construction Framing Shift (+₦8,500 Cash)';
      bizBtn.textContent = '🏡 Ajah Peninsula Properties [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'balogun-market') {
      btnEl.textContent = '👗 Buy Wholesale Ankara Fabric Bale (₦6,000)';
      bizBtn.style.display = 'none';
    } else {
      btnEl.textContent = 'Enter / Inspect';
      bizBtn.style.display = 'none';
    }

    this.interactionCard.style.display = 'block';
  }

  public showDrivingHUD(vehicleName: string): void {
    if (this.drivingHudEl) {
      this.drivingHudEl.style.display = 'flex';
      const nameEl = document.getElementById('driving-veh-name');
      if (nameEl) nameEl.textContent = vehicleName;
    }
  }

  public hideDrivingHUD(): void {
    if (this.drivingHudEl) {
      this.drivingHudEl.style.display = 'none';
    }
  }

  public updateDrivingHUD(speedMps: number): void {
    const speedValEl = document.getElementById('speedo-val');
    if (speedValEl) {
      const kmh = Math.round(Math.abs(speedMps) * 3.6);
      speedValEl.textContent = kmh.toString();
    }
  }

  public hideInteractionCard(): void {
    this.interactionCard.style.display = 'none';
    this.currentActiveObject = null;
  }

  private handleCardAction(): void {
    if (!this.currentActiveObject) return;
    const id = this.currentActiveObject.id;

    if (id === 'mama-put') {
      this.hideInteractionCard();
      this.onEnterInterior?.('restaurant');
      return;
    } else if (id === 'lagos-bank') {
      this.hideInteractionCard();
      this.onEnterInterior?.('bank');
      return;
    } else if (id === 'lagos-hospital') {
      this.hideInteractionCard();
      this.onEnterInterior?.('hospital');
      return;
    } else if (id === 'police-station') {
      this.hideInteractionCard();
      this.onEnterInterior?.('police');
      return;
    } else if (id === 'villa-compound' || id === 'palm-view-flats') {
      this.hideInteractionCard();
      this.onEnterInterior?.('residence');
      return;
    } else if (id === 'interior_exit_door') {
      this.hideInteractionCard();
      this.onExitInterior?.();
      return;
    } else if (id === 'hosp_reception') {
      const success = this.backend.spendCash(500, 'Hospital Triage Registration');
      if (success) {
        this.backend.restoreHealth(20);
        alert('🩺 Nurse Chidinma: "Registration complete! Blood pressure 120/80. Doctor Adeleke is waiting in Consultation Room 1."');
      } else {
        alert('❌ Need ₦500 cash for hospital patient registration!');
      }
      return;
    } else if (id === 'hosp_doctor_desk') {
      const success = this.backend.spendCash(2500, 'Doctor Adeleke Medical Consultation');
      if (success) {
        this.backend.restoreHealth(100);
        this.backend.restoreEnergy(50);
        this.backend.addStreetCred(10);
        alert('👨‍⚕️ Dr. Adeleke: "Your diagnosis is looking good! Administered a high-potency vitamin injection. Health fully restored to 100%!"');
      } else {
        alert('❌ Need ₦2,500 cash for full medical consultation!');
      }
      return;
    } else if (id === 'hosp_ward_bed') {
      this.backend.restoreHealth(100);
      this.backend.restoreEnergy(100);
      alert('💧 You rest peacefully on the medical bed. The saline drip cleanses your system. 100% Health & Energy restored!');
      return;
    } else if (id === 'hosp_pharmacy') {
      const success = this.backend.spendCash(1800, 'Coartem Malaria Pack');
      if (success) {
        this.backend.addItem({
          id: `coartem_${Date.now()}`,
          name: 'Coartem Malaria Dose',
          category: 'medicine',
          icon: '💊',
          description: 'Gold standard fast-acting anti-malarial blister pack.',
          price: 1800,
          usable: true,
          energyRestore: 40,
        });
        alert('💊 Pharmacist Kemi: "Here is your Coartem dose! Added to your bag. Take two tablets twice daily with water."');
      } else {
        alert('❌ Need ₦1,800 cash for Coartem malaria medicine!');
      }
      return;
    } else if (id === 'bank_atm_station') {
      this.backend.addCash(10000);
      alert('🏧 *Cash dispenser sound* ₦10,000 cash dispensed into your pocket! Thank you for banking with Eko Commercial Bank.');
      return;
    } else if (id === 'bank_teller_station') {
      this.backend.addCash(25000);
      this.backend.addStreetCred(15);
      alert('💱 Teller Ngozi: "Diaspora foreign wire transfer verified! ₦25,000 cash paid over the counter. Street Cred +15!"');
      return;
    } else if (id === 'bank_manager_desk') {
      this.backend.addCash(50000);
      this.backend.addStreetCred(30);
      alert('💼 Manager Bankole: "Lagos SME Business Loan approved! ₦50,000 capital disbursed to your wallet! Street Cred +30!"');
      return;
    } else if (id === 'buka_food_counter') {
      const success = this.backend.spendCash(1800, 'Firewood Party Jollof & Chicken');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.restoreHealth(30);
        this.backend.addItem({
          id: `takeaway_jollof_${Date.now()}`,
          name: 'Takeaway Firewood Jollof Pack',
          category: 'food',
          icon: '🍲',
          description: 'Insulated foil takeaway pack with spicy firewood party jollof and chicken.',
          price: 1800,
          usable: true,
          energyRestore: 60,
        });
        alert('🍲 Mama Nkechi: "Oya chop life! Smoky firewood Jollof dished fresh for you! Energy restored to 100%, and extra takeaway packed in your bag!"');
      } else {
        alert('❌ Need ₦1,800 cash for firewood party jollof!');
      }
      return;
    } else if (id === 'buka_table_vip') {
      const success = this.backend.spendCash(2500, 'VIP Chapman & Pepper Soup Platter');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.restoreHealth(50);
        this.backend.addStreetCred(20);
        alert('🍹 Waiter Segun: "Chilled Chapman and catfish pepper soup served! Total relaxation achieved! Energy 100%, Street Cred +20!"');
      } else {
        alert('❌ Need ₦2,500 cash for VIP table & pepper soup!');
      }
      return;
    } else if (id === 'police_front_desk') {
      const success = this.backend.spendCash(500, 'Citizen Incident Report Documentation');
      if (success) {
        this.backend.addStreetCred(20);
        alert('👮 Sgt. Danladi: "Report documented in the Lagos Area Command logbook! Reference Number: #NIG-8492. +20 Street Cred!"');
      } else {
        alert('❌ Need ₦500 documentation fee for report filing.');
      }
      return;
    } else if (id === 'police_holding_cell') {
      const success = this.backend.spendCash(5000, 'Citizen Bail Bond');
      if (success) {
        this.backend.addStreetCred(40);
        alert('⚖️ Sgt. Danladi: "Bail bond processed! Suspect Kazeem has been released on good behavior. You earned massive respect in the community (+40 Street Cred)!"');
      } else {
        alert('❌ Need ₦5,000 cash for bail bond release!');
      }
      return;
    } else if (id === 'flat-workstation') {
      this.backend.addCash(12000);
      this.backend.addStreetCred(20);
      alert('💻 Pull request approved and merged! ₦12,000 remote salary credited to your wallet! Street Cred +20!');
      return;
    } else if (id.startsWith('interior_npc_')) {
      alert(`💬 ${this.currentActiveObject.description}`);
      return;
    } else if (id === 'bet-shop') {
      const success = this.backend.spendCash(1000, 'Bet9ja 5-Game Ticket');
      if (success) {
        // 50% chance of winning quick ticket
        const won = Math.random() < 0.45;
        if (won) {
          const winAmount = 15000;
          this.backend.addCash(winAmount);
          this.backend.addStreetCred(10);
          alert(`🎉 BOOM! Your match ticket came through! Won ₦${winAmount.toLocaleString()} cash! Oya celebration!`);
        } else {
          this.backend.addItem({
            id: `ticket_${Date.now()}`,
            name: 'Weekend Match Slip',
            category: 'document',
            icon: '🎫',
            description: 'Arsenal vs Chelsea accumulator ticket. Fingers crossed!',
            price: 1000,
            usable: false,
          });
          alert('⚽ Ticket placed! Added to your bag. May your odds favor you!');
        }
      } else {
        alert('❌ Not enough cash! ₦1,000 needed to book ticket.');
      }
    } else if (id === 'npc-hawker') {
      const success = this.backend.spendCash(200, 'Cold Water & Gala');
      if (success) {
        this.backend.restoreEnergy(25);
        this.backend.addItem({
          id: 'water_sachet',
          name: 'Chilled Pure Water Sachet',
          category: 'food',
          icon: '💧',
          description: 'Chilled sachet water to quench Lagos afternoon heat.',
          price: 100,
          usable: true,
          energyRestore: 15,
        });
        alert('🥤 Chilled water and Gala purchased! Added to bag and energy boosted.');
      } else {
        alert('❌ Need ₦200 cash for water & gala!');
      }
    } else if (id.startsWith('veh-')) {
      this.hideInteractionCard();
      this.onEnterVehicle?.(id);
      return;
    } else if (id === 'danfo-stop') {
      this.hideInteractionCard();
      this.travelModal.open();
      return;
    } else if (id === 'npc-conductor') {
      const fare = 300;
      const success = this.backend.spendCash(fare, 'Danfo Bus Fare');
      if (success) {
        this.backend.addStreetCred(5);
        if (this.player) {
          // Commute shuttle across the commercial boulevard
          this.player.mesh.position.set(-8.5, 0, -55);
        }
        alert(`🚌 DANFO COMMUTER SHUTTLE: Paid ₦${fare} fare! Conductor shouts: "Tejuosho Junction drop off! Oya alight, next passenger enter!" You commuted swiftly across Broad Street.`);
      } else {
        alert('❌ "Hold your ₦300 exact change first before entering my motor!" - Conductor');
      }
    } else if (id === 'villa-compound') {
      const villa = this.backend.getData().properties.find((p) => p.buildingId === 'villa-compound' || p.id === 'prop_villa_estate');
      const isTenant = villa ? (villa.status === 'owned' || villa.status === 'rented' || villa.status === 'purchased') : false;
      if (isTenant && this.world) {
        const isOpen = this.world.buildings.toggleCompoundGate();
        alert(isOpen ? '🚪 Compound gate opened! You can walk into the estate courtyard.' : '🚪 Compound gate closed and secured.');
      } else {
        alert('🔔 Gateman: "Good day Sah! If you want to lease or buy this duplex, check the Estate Office [E]!"');
      }
    } else if (id === 'vi-tower') {
      alert('🏢 Eko Atlantic Corporate Concierge: "Welcome to the Financial District! Top-tier investments, private equity desks, and crypto fintechs are based here."');
    } else if (id === 'vi-lounge' || id === 'quilox-club') {
      const success = this.backend.spendCash(25000, 'Quilox Dom Pérignon & VIP Sparklers Table');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.addStreetCred(35);
        this.backend.addItem({
          id: `dom_perignon_${Date.now()}`,
          name: 'Dom Pérignon Vintage Champagne',
          category: 'food',
          icon: '🍾',
          description: 'Vintage French champagne served with blazing sparklers on Victoria Island.',
          price: 65000,
          usable: true,
          energyRestore: 50,
        });
        this.player?.playEmote('groove', 5.0);
        alert('🍾 QUILOX VIP TABLE IS LIT! Bottle sparklers flaming, DJ spinning Wizkid & Burna Boy, Dom Pérignon poured! Energy 100%, Street Cred +35! You are officially balling!');
      } else {
        alert('❌ Need ₦25,000 cash for Quilox VIP Table & champagne! Go to the ATM to withdraw funds.');
      }
    } else if (id === 'amala-shitta') {
      const success = this.backend.spendCash(2000, 'Hot Amala Dudu + Abula & Goat Meat');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `amala_takeaway_${Date.now()}`,
          name: 'Amala Shitta Takeaway Wrap',
          category: 'food',
          icon: '🍲',
          description: 'Steaming hot yam flour amala with ewedu, gbegiri, and spicy goat meat.',
          price: 2000,
          usable: true,
          energyRestore: 60,
        });
        alert('🍲 OYA CHOP AMALA! Steaming hot Amala Dudu served with yellow Gbegiri, green Ewedu & tender Goat Meat! 100% Energy restored, Street Cred +15!');
      } else {
        alert('❌ Need ₦2,000 cash for hot Amala & Goat Meat!');
      }
    } else if (id === 'nepa-generator') {
      const success = this.backend.spendCash(1200, '5L Mobil Petrol for Tiger Generator');
      if (success) {
        this.backend.restoreEnergy(20);
        this.backend.addStreetCred(20);
        alert('⚡ *KPA-KPA-KPA-VROOOOM!* Tiger generator cranked up! Blue smoke puffs and the entire market roars: "UP NEPA! OYA LIGHT DON ENTER!" Street Cred +20!');
      } else {
        alert('❌ Need ₦1,200 cash for 5 litres of generator petrol!');
      }
    } else if (id === 'cv-plaza') {
      const success = this.backend.spendCash(5000, 'Otigba 20,000mAh Power Bank');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `powerbank_${Date.now()}`,
          name: 'Otigba 20,000mAh Fast Power Bank',
          category: 'tool',
          icon: '🔋',
          description: 'Heavy-duty power bank with fast-charging cables for uninterrupted Lagos hustle.',
          price: 5000,
          usable: false,
        });
        alert('🔌 20,000mAh Power Bank purchased from Otigba market! Added to bag. Never get stranded on 1% battery again!');
      } else {
        alert('❌ Need ₦5,000 cash for the power bank!');
      }
    } else if (id === 'lekki-bridge') {
      const success = this.backend.spendCash(500, 'Lekki Toll Transit');
      if (success) {
        this.backend.addStreetCred(5);
        alert('🌉 Toll paid! Barrier green light lifted: "Welcome to Lekki Phase 1 & Admiralty Way!"');
      } else {
        alert('❌ Need ₦500 cash for bridge toll fee!');
      }
    } else if (id === 'nike-art-gallery') {
      const success = this.backend.spendCash(12000, 'Handmade Nike Art Adire Batik');
      if (success) {
        this.backend.addStreetCred(35);
        this.backend.addItem({
          id: `adire_art_${Date.now()}`,
          name: 'Nike Art Adire Batik Masterpiece',
          category: 'document',
          icon: '🎨',
          description: 'Indigo-dyed handcrafted textile artwork from Nike Art Gallery.',
          price: 25000,
          usable: false,
        });
        alert('🎨 Exclusive Nigerian Batik artwork purchased! Added to bag. Street Cred skyrocketed by +35!');
      } else {
        alert('❌ Ineffective funds! ₦12,000 needed for the gallery artwork.');
      }
    } else if (id === 'yaba-cchub') {
      this.backend.restoreEnergy(20);
      this.backend.addCash(15000);
      this.backend.addStreetCred(25);
      this.backend.addItem({
        id: `github_token_${Date.now()}`,
        name: 'CcHub High-Yield Smart Contract',
        category: 'document',
        icon: '💻',
        description: 'Deployed web3 micro-service for a Silicon Valley fintech client.',
        price: 25000,
        usable: false,
      });
      alert('💻 CCHUB HACKATHON DELIVERED! You pulled an all-night code sprint at Herbert Macaulay Way. Earned ₦15,000 cash, +25 Street Cred, and deployed your code!');
    } else if (id === 'surulere-stadium') {
      const success = this.backend.spendCash(1000, 'Teslim Balogun Stadium Pass');
      if (success) {
        this.backend.restoreEnergy(50);
        this.backend.addStreetCred(15);
        this.player?.playEmote('groove', 4.0);
        alert('🏃 SURULERE ATHLETIC WORKOUT: Ran laps around the Teslim Balogun tartan track! Energy boosted +50, Street Cred +15!');
      } else {
        alert('❌ Need ₦1,000 for stadium gate fee!');
      }
    } else if (id === 'mma-airport') {
      this.hideInteractionCard();
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
      return;
    } else if (id === 'ajah-estate') {
      this.backend.addCash(8500);
      this.backend.addStreetCred(10);
      alert('👷 AJAH SITE LABOUR: Mixed mortar, hoisted hollow blocks, and completed framing! Earned ₦8,500 cash on the spot!');
    } else if (id === 'balogun-market') {
      const success = this.backend.spendCash(6000, 'Wholesale Ankara Bundle');
      if (success) {
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `ankara_bundle_${Date.now()}`,
          name: 'Balogun Luxury Ankara Fabric Bale',
          category: 'document',
          icon: '👗',
          description: 'High-grade 6-yard Dutch Wax print direct from Balogun wholesale merchants.',
          price: 14000,
          usable: false,
        });
        alert('👗 BALOGUN MARKET WHOLESALE! Bought 6 yards of vibrant premium Ankara wax fabric for ₦6,000! Can be sold for ₦14,000 in your boutique!');
      } else {
        alert('❌ Need ₦6,000 for wholesale fabric bundle!');
      }
    } else if (id === 'npc-punter') {
      alert('🗣️ Segun: "Guy, always play over 1.5 goals o! Don\'t play straight win, this league is crazy!"');
    } else if (id === 'aso-rock-lookout') {
      const success = this.backend.spendCash(1500, 'Aso Rock Souvenir Plaque');
      if (success) {
        this.backend.restoreEnergy(30);
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `aso_rock_plaque_${Date.now()}`,
          name: 'Aso Rock Presidential Plaque',
          category: 'document',
          icon: '⛰️',
          description: 'Official commemorative stone souvenir plaque of the Aso Rock Monolith & Three Arms Zone.',
          price: 3500,
          usable: false,
        });
        alert('⛰️ Stood at the pinnacle of power! Aso Rock Presidential Plaque purchased and added to bag. Street Cred +20!');
      } else {
        alert('❌ Need ₦1,500 cash for the commemorative souvenir plaque!');
      }
    } else if (id === 'abuja-mosque') {
      const success = this.backend.spendCash(500, 'Mosque Visit & Chilled Zobo');
      if (success) {
        this.backend.restoreEnergy(60);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `abuja_zobo_${Date.now()}`,
          name: 'Abuja Spiced Zobo Drink',
          category: 'food',
          icon: '🧃',
          description: 'Chilled hibiscus tea with ginger, clove, and pineapple.',
          price: 500,
          usable: true,
          energyRestore: 35,
        });
        alert('🕌 Visited the magnificent National Mosque! Chilled spiced Zobo drink acquired, energy refreshed, Street Cred +15!');
      } else {
        alert('❌ Need ₦500 for the visitor pack & zobo!');
      }
    } else if (id === 'abuja-christian-centre') {
      const success = this.backend.spendCash(500, 'Ecumenical Fellowship Offering');
      if (success) {
        this.backend.restoreEnergy(60);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `unity_hymnal_${Date.now()}`,
          name: 'National Unity Hymnal & Medallion',
          category: 'document',
          icon: '📖',
          description: 'Commemorative unity hymnal from the National Christian Centre.',
          price: 1000,
          usable: false,
        });
        alert('⛪ Admired the neo-gothic spire and pipe organ at National Christian Centre! Blessed with peaceful spirit and Street Cred +15!');
      } else {
        alert('❌ Need ₦500 cash offering!');
      }
    } else if (id === 'abuja-secretariat') {
      const success = this.backend.spendCash(5000, 'Federal Government Tender Form');
      if (success) {
        this.backend.addStreetCred(50);
        this.backend.addItem({
          id: `fgn_cert_${Date.now()}`,
          name: 'Official Federal Contractor Certificate',
          category: 'document',
          icon: '📜',
          description: 'Registered Bureau of Public Procurement (BPP) Federal Contractor Certificate #FGN-2026.',
          price: 15000,
          usable: false,
        });
        alert('📜 Official Federal Contractor registration submitted! Verified BPP Certificate issued to bag. Capital Street Cred +50!');
      } else {
        alert('❌ Need ₦5,000 cash for the federal procurement registration documentation!');
      }
    } else if (id === 'abuja-cab') {
      const success = this.backend.spendCash(800, 'Federal Green Cab Fare');
      if (success) {
        this.backend.addStreetCred(5);
        if (this.player) {
          this.player.mesh.position.z -= 30;
        }
        alert('🚕 Green Cab dropped you off smoothly by Shehu Shagari Way & Maitama Junction! "Oga drop here! Well done sir!"');
      } else {
        alert('❌ Need ₦800 cash for green cab fare!');
      }
    } else if (id === 'abuja-interstate-hub') {
      this.hideInteractionCard();
      this.interstateModal.open('abuja');
      return;
    } else if (id === 'mma-airport') {
      this.hideInteractionCard();
      this.interstateModal.open('lagos');
      return;
    } else if (id === 'flat-tv') {
      this.backend.restoreEnergy(25);
      this.backend.addStreetCred(10);
      this.player?.playEmote('groove', 4.0);
      alert('📺 GOOOOAL! Osimhen scores for Super Eagles! 🦅 The whole flat erupts in wild celebration! Energy +25, Mood: Electric!');
    } else if (id === 'flat-bed') {
      this.backend.restoreEnergy(100);
      alert('🛏️ Sweet dreams! You slept peacefully under the ceiling fan. Energy restored to 100%!');
    } else if (id === 'flat-drum') {
      this.backend.restoreEnergy(40);
      alert('🪣 SPLASH! Cold water bath from the iconic blue drum with red bowl! You feel super clean, fresh and sharp! Energy +40%!');
    } else if (id === 'flat-sofa') {
      this.backend.restoreEnergy(30);
      alert('🛋️ Chilled out on the living room sofa enjoying cold malt drink. Energy +30%!');
    } else if (id === 'pharmacy') {
      const success = this.backend.spendCash(1500, 'Yaba Pharmacy First Aid & Coartem');
      if (success) {
        this.backend.restoreEnergy(50);
        this.backend.addItem({
          id: `first_aid_${Date.now()}`,
          name: 'First Aid Kit & Coartem',
          category: 'tool',
          icon: '💊',
          description: 'Emergency medical health kit with anti-malaria tablets and vitamins.',
          price: 2500,
          usable: true,
          energyRestore: 50,
        });
        alert('💊 Yaba Central Pharmacy: Quality medications dispensed! Energy boosted +50% and First Aid Kit added to your bag!');
      } else {
        alert('❌ Need ₦1,500 cash for pharmacy medications!');
      }
    } else if (id === 'supermarket') {
      const success = this.backend.spendCash(4500, 'Everyday Supermarket Groceries');
      if (success) {
        this.backend.restoreEnergy(80);
        this.backend.addItem({
          id: `indomie_pack_${Date.now()}`,
          name: 'Carton of Indomie & Peak Milk',
          category: 'food',
          icon: '🍜',
          description: 'Noodles, golden butter bread, and peak milk from the supermarket.',
          price: 4500,
          usable: true,
          energyRestore: 80,
        });
        alert('🛒 Everyday Supermarket: Groceries checked out! Added Indomie Super Pack & Milk to your bag!');
      } else {
        alert('❌ Need ₦4,500 cash for supermarket groceries!');
      }
    } else if (id === 'slot-gadgets') {
      const success = this.backend.spendCash(8500, 'Slot 20,000mAh Power Bank & Charger');
      if (success) {
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `powerbank_slot_${Date.now()}`,
          name: 'Slot 20,000mAh Dual-Port Power Bank',
          category: 'gadget',
          icon: '🔋',
          description: 'High-capacity fast-charging power bank with braided nylon cables.',
          price: 12000,
          usable: false,
        });
        alert('📱 Slot Gadgets: High-capacity power bank & fast charger purchased! Added to bag. Street Cred +15!');
      } else {
        alert('❌ Need ₦8,500 cash for the power bank & charger!');
      }
    } else if (id === 'barber-shop') {
      const success = this.backend.spendCash(2500, 'Executive Fade & Beard Grooming');
      if (success) {
        this.backend.restoreEnergy(40);
        this.backend.addStreetCred(25);
        this.player?.playEmote('groove', 4.0);
        alert('💈 Fresh Cut Barbershop: Sharp executive fade with peppermint beard oil! You look clean! Street Cred +25!');
      } else {
        alert('❌ Need ₦2,500 cash for the haircut!');
      }
    } else if (id === 'fuel-station') {
      const success = this.backend.spendCash(8500, '10L Petrol Fuel Keg');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `fuel_keg_${Date.now()}`,
          name: '10L Premium Petrol (Fuel Keg)',
          category: 'tool',
          icon: '⛽',
          description: 'Yellow jerrycan filled with 10 litres of premium fuel for your generator or car.',
          price: 8500,
          usable: true,
          energyRestore: 0,
        });
        alert('⛽ Oando Fuel Station: 10 Litres of petrol fueled! Ready for your car or home generator!');
      } else {
        alert('❌ Need ₦8,500 cash for 10L fuel!');
      }
    } else if (id === 'mechanic') {
      const success = this.backend.spendCash(6000, 'Vehicle Tune Up & Oil Change');
      if (success) {
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `engine_oil_${Date.now()}`,
          name: 'Castrol High-Grade Engine Oil',
          category: 'tool',
          icon: '🛢️',
          description: 'High-viscosity synthetic lubricant for vehicle engine overhaul.',
          price: 6000,
          usable: true,
        });
        alert("🔧 God's Grace Auto Works: Engine serviced, spark plugs cleaned, and fresh engine oil poured! Vehicle running at peak performance!");
      } else {
        alert('❌ Need ₦6,000 cash for vehicle service!');
      }
    } else if (id === 'construction-site') {
      const energyDepleted = this.backend.depleteEnergy(25);
      if (energyDepleted) {
        const wage = 6500;
        this.backend.addCash(wage);
        this.backend.addStreetCred(10);
        alert(`👷 Tough day shift completed! Carried sandcrete blocks and mixed concrete. +₦${wage.toLocaleString()} cash paid into your pocket! Energy -25%`);
      } else {
        alert('❌ You are too exhausted! (Need at least 25% Energy). Eat at Mama Put or sleep in your apartment first.');
      }
    } else if (id === 'palm-view-flats') {
      this.hideInteractionCard();
      this.economyModal.open('palm-view-flats');
      return;
    } else if (id === 'npc-suya') {
      const success = this.backend.spendCash(1500, 'Hot Spicy Beef Suya');
      if (success) {
        this.backend.restoreEnergy(60);
        this.backend.addItem({
          id: `suya_wrap_${Date.now()}`,
          name: 'Spicy Beef Suya Wrap',
          category: 'food',
          icon: '🥩',
          description: 'Charcoal-grilled Nigerian beef suya coated in fragrant yaji spice and sliced onions.',
          price: 1500,
          usable: true,
          energyRestore: 60,
        });
        alert('🥩 Mallam Bisi: "Gaskiya! Fresh hot suya wrapped with extra yaji pepper and sliced onions! Oya enjoy!"');
      } else {
        alert('❌ Need ₦1,500 cash for hot suya!');
      }
    } else if (id === 'npc-emeka') {
      const success = this.backend.spendCash(3000, 'Phone Calibration & 5G SIM');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `mtn_sim_${Date.now()}`,
          name: '5G MTN High-Speed Data SIM',
          category: 'gadget',
          icon: '📶',
          description: 'High-speed broadband SIM card with 10GB pre-loaded data bundle.',
          price: 3000,
          usable: false,
        });
        alert('📱 Emeka: "Phone charging port cleaned, firmware flashed, and 5G data SIM activated!"');
      } else {
        alert('❌ Need ₦3,000 cash for phone service & 5G SIM!');
      }
    } else if (id === 'npc-mechanic') {
      const energyDepleted = this.backend.depleteEnergy(15);
      if (energyDepleted) {
        const gigWage = 4000;
        this.backend.addCash(gigWage);
        this.backend.addStreetCred(10);
        alert(`🛠️ Master Tayo: "Good job boy! You helped align the alternator belt and brake pads. Take ₦${gigWage.toLocaleString()} cash for your pocket!" Energy -15%`);
      } else {
        alert('❌ Too exhausted for manual workshop labor! Rest first.');
      }
    } else if (id === 'npc-warden') {
      this.backend.addStreetCred(10);
      this.player?.playEmote('salute', 3.0);
      alert('👮 Sgt. Bello: "Always obey traffic signals and cross at zebra lines! Broad Street traffic flows smoothly when citizens stay sharp! Street Cred +10!"');
    } else if (id === 'npc-chief') {
      this.backend.addStreetCred(25);
      this.player?.playEmote('salute', 3.0);
      alert('👑 Chief Alabi: "God bless you my child! In Lagos, integrity, perseverance and courage will open doors that ordinary money cannot open. Respect +25!"');
    } else if (id === 'npc-aunty') {
      const success = this.backend.spendCash(18000, 'Original Hollandais Wax Fabric');
      if (success) {
        this.backend.addStreetCred(30);
        this.backend.addItem({
          id: `ankara_hollandais_${Date.now()}`,
          name: 'Original Hollandais Wax Fabric (6 Yards)',
          category: 'document',
          icon: '👗',
          description: 'Prestigious Dutch wax cotton fabric with vibrant gold and indigo peacock motifs.',
          price: 25000,
          usable: false,
        });
        alert('👗 Mama Nkechi: "Original Vlisco Hollandais Dutch Wax! You have great taste my customer! Street Cred +30!"');
      } else {
        alert('❌ Need ₦18,000 cash for authentic Hollandais wax fabric!');
      }
    } else if (id === 'npc-banker') {
      const cost = 50000;
      let paid = this.backend.spendCash(cost, '90-Day FGN Treasury Bill');
      if (!paid && this.backend.getData().bank.balance >= cost) {
        this.backend.withdrawFromATM(cost);
        paid = this.backend.spendCash(cost, '90-Day FGN Treasury Bill');
      }
      if (paid) {
        this.backend.addStreetCred(40);
        this.backend.addItem({
          id: `tbill_${Date.now()}`,
          name: '90-Day FGN Treasury Bill Note (18.5% ROI)',
          category: 'document',
          icon: '📈',
          description: 'Official Central Bank sovereign security yielding 18.5% annual risk-free return.',
          price: 59250,
          usable: false,
        });
        alert('📈 Tunde: "Treasury bill registered with CSCS clearing depository! You will earn guaranteed 18.5% sovereign yield upon maturity! Street Cred +40!"');
      } else {
        alert('❌ Need ₦50,000 in cash or bank balance to purchase Treasury Bills!');
      }
    }

    this.hideInteractionCard();
  }

  public updateOnlineCount(count: number): void {
    const el = document.getElementById('hud-online-count');
    if (el) {
      el.textContent = `${count} Online`;
    }
  }

  public showNotification(msg: string): void {
    let toast = document.getElementById('hud-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hud-floating-toast';
      toast.style.cssText = `
        position: fixed;
        top: 84px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.5);
        color: #f8fafc;
        padding: 10px 22px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.3);
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    if ((this as any)._toastTimeout) {
      clearTimeout((this as any)._toastTimeout);
    }
    (this as any)._toastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
      }
    }, 2800);
  }
}
